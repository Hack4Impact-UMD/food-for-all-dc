import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import NewIcon from "@mui/icons-material/NewLabel";
import CloseIcon from "@mui/icons-material/Close";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
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
import { getReadableTagTextColor } from "../../../utils/tagColors";

interface TagProps {
  text: string;
  color?: string;
  handleTag: (text: string) => void;
  onEdit: (text: string) => void;
  setInnerPopup: (isOpen: boolean) => void;
  values: string[];
  createTag: boolean;
  deleteMode: boolean;
  setTagToDelete: (tag: string) => void;
}

// Enhanced styled component for the tag container with improved visuals
const TagContainer = styled("button")({
  appearance: "none",
  backgroundColor: "rgba(0, 0, 0, 0.06)",
  border: 0,
  color: "inherit",
  font: "inherit",
  margin: 0,
  textAlign: "center",
  borderRadius: "20px",
  padding: "5px 12px",
  minWidth: "60px",
  minHeight: "30px",
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
  "&:focus-visible": {
    outline: "2px solid var(--color-primary)",
    outlineOffset: "2px",
  },
  "&.active": {
    backgroundColor: "var(--color-primary)",
    color: "var(--color-background-main)",
    boxShadow: "0 2px 6px rgba(37, 126, 104, 0.2)",
  },
});

const createTagContainerStyles = {
  appearance: "none",
  backgroundColor: "rgba(37, 126, 104, 0.04)",
  color: "inherit",
  font: "inherit",
  margin: 0,
  borderRadius: "20px",
  padding: "5px 12px",
  cursor: "pointer",
  border: "1px dashed rgba(37, 126, 104, 0.3)",
  transition: "all 0.2s ease",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "60px",
  minHeight: "30px",
  position: "relative",
  "&:hover": {
    backgroundColor: "rgba(37, 126, 104, 0.06)",
    transform: "translateY(-2px)",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
  },
  "&:focus-visible": {
    outline: "2px solid var(--color-primary)",
    outlineOffset: "2px",
  },
} as const;

const CreateTagContainer = styled(Box)(createTagContainerStyles);
const CreateTagButton = styled("button")(createTagContainerStyles);

const TagText = styled("span")({
  fontSize: "0.85rem",
  fontWeight: 500,
  letterSpacing: "0.3px",
});

const Tag: React.FC<TagProps> = ({
  text,
  color,
  handleTag,
  onEdit,
  values,
  createTag,
  setInnerPopup,
  deleteMode,
  setTagToDelete,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleRemoveClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowActions(true);
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
        <TagContainer
          type="button"
          aria-label={`Manage ${text} tag`}
          className={values.includes(text) ? "active" : ""}
          onClick={handleRemoveClick}
          style={
            values.includes(text) && color
              ? { backgroundColor: color, color: getReadableTagTextColor(color) }
              : undefined
          }
        >
          <TagText>{text}</TagText>
        </TagContainer>
        <StyledDialog open={showActions} onClose={() => setShowActions(false)} TransitionComponent={Fade}>
          <DialogTitle sx={{ textAlign: "center", fontWeight: 700 }}>Manage Tag</DialogTitle>
          <DialogContent sx={{ textAlign: "center", minWidth: 320, px: 3 }}>
            <Typography sx={{ color: "var(--color-text-secondary)", mb: 2 }}>
              What would you like to do with <b>{text}</b>?
            </Typography>
            <Box sx={{ display: "flex", gap: 1.5, width: "100%" }}>
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => {
                  setShowActions(false);
                  onEdit(text);
                }}
                sx={{ flex: 1, minWidth: 0, borderRadius: 2, textTransform: "none", fontWeight: 600 }}
              >
                Edit tag
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteOutlineIcon />}
                onClick={() => {
                  setShowActions(false);
                  setShowConfirm(true);
                }}
                sx={{ flex: 1, minWidth: 0, borderRadius: 2, textTransform: "none", fontWeight: 600 }}
              >
                Remove from profile
              </Button>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowActions(false)} sx={{ width: "100%" }}>
              Cancel
            </Button>
          </DialogActions>
        </StyledDialog>
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
        <CreateTagButton
          type="button"
          aria-label="Edit tags"
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
        </CreateTagButton>
      </Tooltip>
    );
  } else {
    return !createTag ? (
      <CreateTagContainer className={values.includes(text) ? "active" : ""}>
        <TagText>{text}</TagText>
        <CloseIcon
          sx={{
            position: "absolute",
            top: -8,
            right: -8,
            backgroundColor: "var(--color-white)",
            color: "#e53935",
            boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.2)",
            borderRadius: "50%",
            width: "20px",
            height: "20px",
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
