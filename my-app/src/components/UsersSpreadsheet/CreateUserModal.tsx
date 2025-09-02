import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  Box,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  FormControl,
  FormLabel,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { UserType } from "../../types"; // Assuming UserType enum is here
import { authUserService } from "../../services/AuthUserService";
import { useAuth } from "../../auth/AuthProvider";

// Define props for the modal
type CreateUserModalProps = {
  open: boolean;
  handleClose: (refreshNeeded?: boolean) => void; // Callback on close, indicates if refresh is needed
};

// Helper function to get display name for UserType
const getRoleDisplayName = (type: UserType): string => {
  switch (type) {
    case UserType.Admin:
      return "Admin";
    case UserType.Manager:
      return "Manager";
    case UserType.ClientIntake:
      return "Client Intake";
    default:
      return "";
  }
};

const CreateUserModal: React.FC<CreateUserModalProps> = ({ open, handleClose }) => {
  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(""); // Optional phone field
  const [role, setRole] = useState<UserType>(UserType.ClientIntake); // Default role
  const [password, setPassword] = useState("");
  const [retypePassword, setRetypePassword] = useState("");

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showRetypePassword, setShowRetypePassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  //user
  const { userRole } = useAuth();

  // Reset form when modal opens or closes
  useEffect(() => {
    if (!open) {
      // Reset all fields when modal closes
      setName("");
      setEmail("");
      setPhone("");
      setRole(UserType.ClientIntake);
      setPassword("");
      setRetypePassword("");
      setShowPassword(false);
      setShowRetypePassword(false);
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleRetypePasswordVisibility = () => setShowRetypePassword(!showRetypePassword);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); // Prevent default form submission
    setError(null); // Clear previous errors

    // Basic Validation
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Name, Email, and Password fields are required.");
      return;
    }

    if (password !== retypePassword) {
      setError("Passwords do not match.");
      return;
    }

    // Password strength (basic example - could be more complex)
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setIsSubmitting(true);

    try {
      const newUser = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined, // Set phone only if provided
        role: role,
      };

      await authUserService.createUser(newUser, password);
      // If successful, close modal and trigger refresh
      handleClose(true);
    } catch (submitError: any) {
      console.error("User creation failed:", submitError);
      // Use the specific error message from the service if available
      setError(submitError.message || "An unexpected error occurred during user creation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => handleClose()} // Close without refresh if user cancels
      maxWidth="sm" // Adjust width as needed
      fullWidth
    >
      <DialogTitle>Create New User</DialogTitle>
      <form onSubmit={handleSubmit}>
        {" "}
        {/* Wrap content in a form tag */}
        <DialogContent>
          {/* Display Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            {/* Shared input style for all fields */}
            {[
              {
                label: "Full Name",
                type: "text",
                value: name,
                onChange: (e: any) => setName(e.target.value),
                required: true,
                error: false,
                helperText: "",
                key: "name",
              },
              {
                label: "Email Address",
                type: "email",
                value: email,
                onChange: (e: any) => setEmail(e.target.value),
                required: true,
                error: false,
                helperText: "",
                key: "email",
              },
              {
                label: "Phone Number (Optional)",
                type: "text",
                value: phone,
                onChange: (e: any) => setPhone(e.target.value),
                required: false,
                error: false,
                helperText: "",
                key: "phone",
              },
            ].map((field) => (
              <TextField
                key={field.key}
                label={field.label}
                type={field.type}
                variant="outlined"
                value={field.value}
                onChange={field.onChange}
                required={field.required}
                disabled={isSubmitting}
                fullWidth
                error={field.error}
                helperText={field.helperText}
                InputProps={{
                  sx: {
                    height: "56px",
                    boxSizing: "border-box",
                    paddingRight: "14px",
                  },
                  inputProps: {
                    sx: {
                      height: "56px",
                      boxSizing: "border-box",
                      padding: "16.5px 14px",
                    },
                  },
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    height: "56px",
                    boxSizing: "border-box",
                  },
                  "& input": {
                    height: "56px",
                    boxSizing: "border-box",
                    padding: "16.5px 14px",
                  },
                }}
              />
            ))}

            {/* Role Selection Radio Group */}
            <FormControl component="fieldset" disabled={isSubmitting}>
              <FormLabel component="legend">User Role</FormLabel>
              <RadioGroup
                row // Display options horizontally
                aria-label="user-role"
                name="user-role-group"
                value={role}
                onChange={(e) => setRole(e.target.value as UserType)}
              >
                {/* Dynamically create radio buttons for each UserType */}
                {[UserType.Admin, UserType.Manager, UserType.ClientIntake].map((type) => (
                  <FormControlLabel
                    key={type}
                    value={type}
                    disabled={userRole === UserType.Manager && type === UserType.Admin}
                    control={<Radio />}
                    label={getRoleDisplayName(type)}
                  />
                ))}
              </RadioGroup>
            </FormControl>

            {/* Password Input */}
            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSubmitting}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment
                    position="end"
                    sx={{ height: "56px", display: "flex", alignItems: "center" }}
                  >
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={togglePasswordVisibility}
                      edge="end"
                      disabled={isSubmitting}
                      sx={{
                        height: "40px",
                        width: "40px",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      tabIndex={-1}
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
                sx: {
                  height: "56px",
                  boxSizing: "border-box",
                  paddingRight: "14px",
                  display: "flex",
                  alignItems: "center",
                },
                inputProps: {
                  sx: {
                    height: "56px",
                    boxSizing: "border-box",
                    padding: "16.5px 14px",
                  },
                },
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  height: "56px",
                  boxSizing: "border-box",
                },
                "& input": {
                  height: "56px",
                  boxSizing: "border-box",
                  padding: "16.5px 14px",
                },
                "& .MuiInputAdornment-root": {
                  height: "56px",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                },
                "& .MuiIconButton-root": {
                  height: "40px",
                  width: "40px",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                },
              }}
            />

            {/* Re-type Password Input */}
            <TextField
              label="Re-type Password"
              type={showRetypePassword ? "text" : "password"}
              variant="outlined"
              value={retypePassword}
              onChange={(e) => setRetypePassword(e.target.value)}
              required
              disabled={isSubmitting}
              error={password !== retypePassword && retypePassword !== ""} // Show error if passwords don't match
              helperText={
                password !== retypePassword && retypePassword !== "" ? "Passwords do not match" : ""
              }
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment
                    position="end"
                    sx={{
                      height: "56px",
                      display: "flex",
                      alignItems: "center",
                      margin: 0,
                      marginRight: "-14px",
                    }}
                  >
                    <IconButton
                      aria-label="toggle retype password visibility"
                      onClick={toggleRetypePasswordVisibility}
                      edge="end"
                      disabled={isSubmitting}
                      sx={{
                        height: "40px",
                        width: "40px",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        "& svg": {
                          fontSize: "1.25rem",
                        },
                      }}
                      tabIndex={-1}
                    >
                      {showRetypePassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
                sx: {
                  height: "56px",
                  boxSizing: "border-box",
                  paddingRight: "14px",
                  display: "flex",
                  alignItems: "center",
                },
                inputProps: {
                  sx: {
                    height: "56px",
                    boxSizing: "border-box",
                    padding: "16.5px 14px",
                  },
                },
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  height: "56px",
                  boxSizing: "border-box",
                },
                "& input": {
                  height: "56px",
                  boxSizing: "border-box",
                  padding: "16.5px 14px",
                },
                "& .MuiInputAdornment-root": {
                  height: "56px",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                },
                "& .MuiIconButton-root": {
                  height: "40px",
                  width: "40px",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleClose()} disabled={isSubmitting}>
            Cancel
          </Button>{" "}
          {/* Disable Cancel if submitting */}
          <Button
            type="submit" // Use type="submit" for the form
            variant="contained"
            color="primary"
            disabled={isSubmitting} // Disable Create if submitting
            startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null} // Show spinner when submitting
          >
            Create User
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CreateUserModal;
