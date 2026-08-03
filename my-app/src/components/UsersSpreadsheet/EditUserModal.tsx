import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  InputAdornment,
} from "@mui/material";
import { AuthUserRow, canCreateUserType, UserType } from "../../types";
import { useAuth } from "../../auth/AuthProvider";
import { authUserService } from "../../services/AuthUserService";
import { formatPhoneNumberForSave } from "../../utils/format";
import PhoneFormatInfo from "./PhoneFormatInfo";

interface EditUserModalProps {
  open: boolean;
  user: AuthUserRow | null;
  handleClose: (updatedUser?: AuthUserRow) => void;
}

const roleOptions = [UserType.Admin, UserType.Manager, UserType.ClientIntake];

const getRoleDisplayName = (role: UserType): string => {
  switch (role) {
    case UserType.Admin:
      return "Admin";
    case UserType.Manager:
      return "Manager";
    case UserType.ClientIntake:
      return "Client Intake";
    default:
      return "Unknown";
  }
};

const EditUserModal: React.FC<EditUserModalProps> = ({ open, user, handleClose }) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserType>(UserType.ClientIntake);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { userRole } = useAuth();

  useEffect(() => {
    if (!open || !user) return;

    setName(user.name);
    setPhone(user.phone || "");
    setRole(user.role);
    setError(null);
    setIsSubmitting(false);
  }, [open, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Full name is required.");
      return;
    }

    const formattedPhone = formatPhoneNumberForSave(phone);
    if (formattedPhone === null) {
      setError(`"${phone}" is an invalid format. Please see the i icon for allowed formats.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await authUserService.updateUser(user.uid, {
        name: trimmedName,
        phone: formattedPhone || undefined,
        role,
      });
      handleClose({
        ...user,
        name: trimmedName,
        phone: formattedPhone || undefined,
        role,
      });
    } catch (submitError: unknown) {
      console.error("User update failed:", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "An unexpected error occurred while updating the user."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !isSubmitting && handleClose()}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Edit User</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Full Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            disabled={isSubmitting}
            autoFocus
            fullWidth
          />

          <TextField
            label="Email Address"
            value={user?.email || ""}
            disabled
            fullWidth
            helperText="Email is used for sign-in and cannot be changed here."
          />

          <TextField
            label="Phone Number (Optional)"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={isSubmitting}
            fullWidth
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <PhoneFormatInfo />
                </InputAdornment>
              ),
            }}
          />

          <FormControl component="fieldset" disabled={isSubmitting}>
            <FormLabel component="legend">User Role</FormLabel>
            <RadioGroup
              row
              aria-label="user-role"
              name="edit-user-role"
              value={role}
              onChange={(event) => setRole(event.target.value as UserType)}
            >
              {roleOptions.map((roleOption) => (
                <FormControlLabel
                  key={roleOption}
                  value={roleOption}
                  disabled={
                    roleOption !== user?.role &&
                    (!userRole || !canCreateUserType(userRole, roleOption))
                  }
                  control={<Radio />}
                  label={getRoleDisplayName(roleOption)}
                />
              ))}
            </RadioGroup>
          </FormControl>

          <Typography variant="body2" color="text.secondary">
            Passwords are not displayed or changed from this page.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => handleClose()} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || !name.trim()}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default EditUserModal;
