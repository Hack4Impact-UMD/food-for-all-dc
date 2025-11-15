import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import NewIcon from "@mui/icons-material/NewLabel";
import CloseIcon from "@mui/icons-material/Close";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import {
  Box,
  Tooltip,
  Typography,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Fade,
} from "@mui/material";
import { styled } from "@mui/system";
import React, { useState } from "react";
import { StyledDialog } from "./TagManager";

interface TagProps {
  text: string;
  handleTag: (text: string) => void;
  setInnerPopup: (isOpen: boolean) => void;
  values: string[];
  createTag: boolean;
  deleteMode: boolean;
  setTagToDelete: (tag: string) => void;
}

// Enhanced styled component for the tag container with improved visuals
const TagContainer = styled(Box)(({ theme }) => ({
  backgroundColor: "rgba(0, 0, 0, 0.06)",
  textAlign: "center",
  borderRadius: "var(--spacing-lg)",
  padding: "5px 12px",
  minWidth: "60px",
  minHeight: "var(--spacing-xl30)",
  cursor: "pointer",
  transition: "all 0.2s ease",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  "&:hover": {
    backgroundColor: "rgba(0, 0, 0, 0.09)",
    transform: "translateY(-2px)",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
  },
  "&.active": {
    backgroundColor: "var(--color-primary)",
    color: "var(--color-background-main)",
    boxShadow: "0 2px 6px rgba(37, 126, 104, 0.2)",
  },
}));

const CreateTagContainer = styled(Box)(({ theme }) => ({
  backgroundColor: "rgba(37, 126, 104, 0.04)",
  borderRadius: "var(--spacing-lg)",
  padding: "5px 12px",
  cursor: "pointer",
  border: "1px dashed rgba(37, 126, 104, 0.3)",
  transition: "all 0.2s ease",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "60px",
  minHeight: "var(--spacing-xl30)",
  position: "relative",
  "&:hover": {
    backgroundColor: "rgba(37, 126, 104, 0.06)",
    transform: "translateY(-2px)",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
  },
}));

const TagText = styled(Typography)({
  fontSize: "0.85rem",
  fontWeight: 500,
  letterSpacing: "0.3px",
});

const Tag: React.FC<TagProps> = ({
  text,
  handleTag,
  values,
  createTag,
  setInnerPopup,
  deleteMode,
  setTagToDelete,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleRemoveClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    handleTag(text);
    setShowConfirm(false);
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  const handleClick = () => {
    handleTag(text);
  };

  if (!deleteMode) {
    return !createTag ? (
      <>
        <TagContainer className={values.includes(text) ? "active" : ""} onClick={handleRemoveClick}>
          <TagText variant="body2">{text}</TagText>
        </TagContainer>
        <StyledDialog open={showConfirm} onClose={handleCancel} TransitionComponent={Fade}>
          <DialogTitle
            sx={{
              textAlign: "center",
              color: "#e53935",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
            }}
          >
            Remove Tag?
          </DialogTitle>
          <DialogContent
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              minWidth: 320,
              textAlign: "center",
            }}
          >
            <Typography sx={{ color: "var(--color-text-secondary)" }}>
              Are you sure you want to remove <b>{text}</b> from this profile?
            </Typography>
          </DialogContent>
          <DialogActions sx={{ justifyContent: "center", gap: 2, pb: 2 }}>
            <Button
              onClick={handleConfirm}
              variant="contained"
              color="error"
              sx={{ borderRadius: 20, fontWeight: 600 }}
            >
              Remove
            </Button>
            <Button
              onClick={handleCancel}
              sx={{ borderRadius: 20, color: "var(--color-primary)", fontWeight: 600 }}
            >
              Cancel
            </Button>
          </DialogActions>
        </StyledDialog>
      </>
    ) : (
      <Tooltip title={"Edit Tags"} placement="top">
        <CreateTagContainer
          className={values.includes(text) ? "active" : ""}
          onClick={() => {
            setInnerPopup(true);
          }}
        >
          <NewIcon
            sx={{
              fontSize: "18px",
              color: "var(--color-primary)",
              padding: 0,
              margin: 0,
            }}
          />
        </CreateTagContainer>
      </Tooltip>
    );
  } else {
    return !createTag ? (
      <CreateTagContainer className={values.includes(text) ? "active" : ""}>
        <TagText variant="body2">{text}</TagText>
        <CloseIcon
          sx={{
            position: "absolute",
            top: -8,
            right: -8,
            backgroundColor: "var(--color-white)",
            color: "#e53935",
            boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.2)",
            borderRadius: "50%",
            width: "var(--spacing-lg)",
            height: "var(--spacing-lg)",
            transition: "all 0.2s ease",
            "&:hover": {
              backgroundColor: "#fff4f2",
              transform: "scale(1.1)",
            },
          }}
          onClick={(e) => {
            e.stopPropagation();
            setInnerPopup(true);
            setTagToDelete(text);
          }}
        />
      </CreateTagContainer>
    ) : (
      <></>
    );
  }
};

export default Tag;
