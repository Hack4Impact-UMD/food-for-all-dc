import { useState, useEffect, SyntheticEvent } from "react";
import Tag from "./Tag";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Typography,
  Chip,
  Fade,
  IconButton,
  styled,
  FilterOptionsState,
  Alert,
} from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import { doc, setDoc, getDoc } from "firebase/firestore";
import dataSources from "../../../config/dataSources";
import { db } from "../../../auth/firebaseConfig";
import { useTagColorPalette, useTagColors } from "../../../context/TagColorContext";
import {
  addTagMetadata,
  DEFAULT_TAG_COLOR,
  findExistingTag,
  getReadableTagTextColor,
  getTagColor,
  updateTagColorPaletteSlot,
} from "../../../utils/tagColors";
import { useClientData } from "../../../context/ClientDataContext";
import {
  assignTagToClient,
  deleteTagGlobally,
  saveTagEdit,
  TagDeleteTooLargeError,
  TagRenameTooLargeError,
} from "./tagPersistence";
import { useAuth } from "../../../auth/AuthProvider";
import { buildClientAuditWriteMetadata } from "../../../utils/clientAudit";

// Define interfaces for tag animations
interface TagWithAnimation {
  id: string;
  text: string;
  hidden?: boolean;
  isDeleting?: boolean;
  isAdding?: boolean;
}

interface TagsProps {
  allTags: string[];
  values: string[];
  handleTag: (
    tag: string,
    options?: { persist?: boolean }
  ) => boolean | void | Promise<boolean | void>;
  onTagRenamed?: (oldTag: string, newTag: string) => void;
  setInnerPopup: (isOpen: boolean) => void;
  deleteMode: boolean;
  setTagToDelete: (tag: string | null) => void;
  clientUid: string; // new prop to update client firebase record
}

export const StyledDialog = styled(Dialog)(({ theme }) => ({
  "& .MuiPaper-root": {
    borderRadius: 18,
    boxShadow: "0 8px 32px rgba(37, 126, 104, 0.18)",
    padding: theme.spacing(2, 2, 2, 2),
    maxWidth: 480,
    width: "100%",
    background: "var(--color-background-main)",
    position: "relative",
  },
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: "1.35rem",
  color: "var(--color-primary)",
  letterSpacing: 0.5,
  marginBottom: theme.spacing(0.5),
}));

const Subtitle = styled(Typography)(({ theme }) => ({
  color: "var(--color-text-secondary)",
  fontSize: "1rem",
  marginBottom: theme.spacing(2),
}));

const TagGrid = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1.2),
  margin: theme.spacing(1, 0, 2, 0),
  justifyContent: "flex-start",
}));

const AddTagButton = styled(Button)(({ theme }) => ({
  background: "var(--color-primary)",
  color: "var(--color-background-main)",
  borderRadius: 20,
  fontWeight: 600,
  textTransform: "none",
  boxShadow: "0 2px 8px rgba(37, 126, 104, 0.10)",
  "&:hover": {
    background: "#1e6656",
  },
  marginLeft: theme.spacing(1),
}));

const DeleteButton = styled(Button)(({ theme }) => ({
  background: "#e53935",
  color: "var(--color-background-main)",
  borderRadius: 20,
  fontWeight: 600,
  textTransform: "none",
  "&:hover": {
    background: "#b71c1c",
  },
}));

const CloseBtn = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  right: theme.spacing(1),
  top: theme.spacing(1),
  color: "var(--color-text-secondary)",
  zIndex: 2,
}));

const filterTagOptions = (options: string[], { inputValue }: FilterOptionsState<string>) =>
  options.filter((option) => option.toLowerCase().includes(inputValue.toLowerCase())).slice(0, 10);

export default function TagManager({
  allTags,
  values,
  handleTag,
  onTagRenamed,
  setInnerPopup,
  deleteMode,
  setTagToDelete,
  clientUid,
}: TagsProps) {
  const [masterTags, setMasterTags] = useState<string[]>(allTags);
  const tagColors = useTagColors();
  const savedColorPalette = useTagColorPalette();
  const { renameClientTag } = useClientData({ autoLoad: false });
  const { user, name } = useAuth();

  const getAuditMetadata = () => {
    if (!user) {
      throw new Error("You must be logged in to update client tags.");
    }
    return buildClientAuditWriteMetadata(user, name);
  };

  // Animation states - similar to delivery animations
  const [tagsWithAnimation, setTagsWithAnimation] = useState<TagWithAnimation[]>([]);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);
  const [addingTagId, setAddingTagId] = useState<string | null>(null);

  useEffect(() => {
    setMasterTags(allTags);
    // Initialize tags with animation data
    setTagsWithAnimation(values.map((tag) => ({ id: tag, text: tag, hidden: false })));
  }, [allTags, values]);

  // Function to refresh tags directly from Firebase
  const refreshMasterTags = async () => {
    try {
      const docRef = doc(db, dataSources.firebase.tagsCollection, dataSources.firebase.tagsDocId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.tags) {
          setMasterTags(data.tags);
        }
      } else {
        console.warn("No tags document found!");
      }
    } catch (error) {
      console.error("Error fetching tags from Firebase:", error);
    }
  };

  const [openAddTagModal, setOpenAddTagModal] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_TAG_COLOR);
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState<number | null>(0);
  const [colorPalette, setColorPalette] = useState(savedColorPalette);
  const [modalMode, setModalMode] = useState<"add" | "remove">("add");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [tagToDelete, setTagToDeleteState] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editedTagName, setEditedTagName] = useState("");
  const [editedTagColor, setEditedTagColor] = useState(DEFAULT_TAG_COLOR);
  const [editedPaletteIndex, setEditedPaletteIndex] = useState<number | null>(null);
  const [editError, setEditError] = useState("");
  const [addError, setAddError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingTag, setIsDeletingTag] = useState(false);

  useEffect(() => {
    setColorPalette(savedColorPalette);
  }, [savedColorPalette]);

  // Filter already applied tags (for adding)
  const availableTags = masterTags.filter((tag: string) => !values.includes(tag));
  const selectedExistingTag = selectedTag
    ? findExistingTag(masterTags, selectedTag.trim())
    : undefined;

  // Animation helper function - similar to delivery components
  const getTagStyle = (tagId: string) => {
    const animatedTag = tagsWithAnimation.find((t) => t.id === tagId);

    if (animatedTag?.hidden || deletingTagId === tagId) {
      return {
        opacity: 0,
        transform: "scale(0.8)",
        transition: "opacity 0.3s ease, transform 0.3s ease",
      };
    }

    if (addingTagId === tagId) {
      return {
        opacity: 1,
        transform: "scale(1)",
        transition: "opacity 0.5s ease-in-out, transform 0.5s ease-in-out",
      };
    }

    return {
      opacity: 1,
      transform: "scale(1)",
      transition: "opacity 0.3s ease, transform 0.3s ease",
    };
  };

  const handleCreateTagClick = () => {
    setModalMode("add");
    setSelectedTag(null);
    setColorPalette(savedColorPalette);
    setSelectedPaletteIndex(0);
    setSelectedColor(savedColorPalette[0]);
    setAddError("");
    setOpenAddTagModal(true);
  };

  const handleEditTagClick = (tag: string) => {
    setEditingTag(tag);
    setEditedTagName(tag);
    const tagColor = getTagColor(tag, tagColors);
    const paletteIndex = savedColorPalette.indexOf(tagColor);
    setColorPalette(savedColorPalette);
    setEditedTagColor(tagColor);
    setEditedPaletteIndex(paletteIndex >= 0 ? paletteIndex : null);
    setEditError("");
  };

  const handleSaveTagEdit = async () => {
    if (!editingTag) return;

    const newTagName = editedTagName.trim();
    if (!newTagName) {
      setEditError("Tag name is required.");
      return;
    }

    const duplicateTag = masterTags.some(
      (tag) => tag !== editingTag && tag.toLocaleLowerCase() === newTagName.toLocaleLowerCase()
    );
    if (duplicateTag) {
      setEditError("A tag with this name already exists.");
      return;
    }

    setIsSavingEdit(true);
    setEditError("");

    try {
      const updatedMetadata = await saveTagEdit({
        db,
        tags: masterTags,
        tagColors,
        tagColorPalette: colorPalette,
        oldTag: editingTag,
        newTag: newTagName,
        newColor: editedTagColor,
        auditMetadata: getAuditMetadata(),
      });

      setMasterTags(updatedMetadata.tags);
      if (newTagName !== editingTag) {
        renameClientTag(editingTag, newTagName);
        onTagRenamed?.(editingTag, newTagName);
      }
      setEditingTag(null);
    } catch (error) {
      console.error("Error editing tag:", error);
      setEditError(
        error instanceof TagRenameTooLargeError
          ? `${error.message} Please contact an administrator.`
          : "The tag could not be updated. Please try again."
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Enhanced handleTag wrapper with animations
  const handleTagWithAnimation = (tagText: string) => {
    const isRemoving = values.includes(tagText);

    if (isRemoving) {
      // Set up removal animation
      setDeletingTagId(tagText);

      // Update animation state to mark as deleting
      setTagsWithAnimation((prev) =>
        prev.map((tag) => (tag.id === tagText ? { ...tag, isDeleting: true, hidden: true } : tag))
      );

      // Delay the actual removal to allow animation
      setTimeout(() => {
        handleTag(tagText); // Call the original handleTag

        // Clean up animation state after removal
        setTimeout(() => {
          setDeletingTagId(null);
          setTagsWithAnimation((prev) => prev.filter((tag) => tag.id !== tagText));
        }, 300); // Match animation duration
      }, 300);
    } else {
      // For adding tags, use the regular handleTag (animation handled in handleAddTag)
      handleTag(tagText);
    }
  };

  // Adding tags: update both the client (Firebase record) and master tags if the tag is new
  const handleAddTag = async () => {
    if (selectedTag && selectedTag.trim() !== "") {
      const requestedTag = selectedTag.trim();
      const existingTag = findExistingTag(masterTags, requestedTag);
      const newTagId = existingTag || requestedTag;
      const updatedMetadata = existingTag
        ? { tags: masterTags, tagColors }
        : addTagMetadata(masterTags, tagColors, newTagId, selectedColor);
      setAddError("");

      let didUpdateClient: boolean | void;
      try {
        if (clientUid) {
          await assignTagToClient({
            db,
            clientUid,
            clientTags: values,
            tag: newTagId,
            metadata: updatedMetadata,
            tagColorPalette: colorPalette,
            auditMetadata: getAuditMetadata(),
          });
          didUpdateClient = await handleTag(newTagId, { persist: false });
        } else {
          await setDoc(
            doc(db, dataSources.firebase.tagsCollection, dataSources.firebase.tagsDocId),
            {
              ...updatedMetadata,
              tagColorPalette: colorPalette,
            },
            { merge: true }
          );
          didUpdateClient = await handleTag(newTagId);
        }
        setMasterTags(updatedMetadata.tags);
      } catch (error) {
        console.error("Error adding tag in Firebase:", error);
        setAddError("The tag could not be added. Please try again.");
        return;
      }

      if (didUpdateClient === false) {
        setAddError("The tag could not be added. Please try again.");
        return;
      }

      setAddingTagId(newTagId);
      setTagsWithAnimation((prev) => [
        ...prev,
        { id: newTagId, text: newTagId, hidden: true, isAdding: true },
      ]);

      // Animate the new tag in after a brief delay
      setTimeout(() => {
        setTagsWithAnimation((prev) =>
          prev.map((tag) => (tag.id === newTagId ? { ...tag, hidden: false, isAdding: true } : tag))
        );

        // Clear animation state after animation completes
        setTimeout(() => {
          setAddingTagId(null);
          setTagsWithAnimation((prev) =>
            prev.map((tag) => (tag.id === newTagId ? { ...tag, isAdding: false } : tag))
          );
        }, 500); // Match animation duration
      }, 100);

      setSelectedTag(null);
      setOpenAddTagModal(false);
    }
  };

  // Removing tags from the master collection AND from all clients
  const handleRemoveTag = async (tagToRemove: string) => {
    setDeleteError("");
    setTagToDeleteState(tagToRemove);
    setShowDeleteConfirm(true);
  };

  const confirmRemoveTag = async () => {
    if (!tagToDelete) return;
    const deletedTagName = tagToDelete; // Store the tag name for success message
    setIsDeletingTag(true);
    setDeleteError("");
    try {
      const updatedMetadata = await deleteTagGlobally({
        db,
        tag: tagToDelete,
        tags: masterTags,
        tagColors,
        auditMetadata: getAuditMetadata(),
      });
      setMasterTags(updatedMetadata.tags);
      if (values.includes(tagToDelete)) {
        await handleTag(tagToDelete, { persist: false });
      }

      // Show success dialog after successful deletion
      setShowDeleteConfirm(false);
      setTagToDeleteState(deletedTagName); // Keep the tag name for the success message
      setShowDeleteSuccess(true);
      setModalMode("add");
      setSelectedTag(null);
    } catch (error) {
      console.error("Error removing tag from Firebase:", error);
      setDeleteError(
        error instanceof TagDeleteTooLargeError
          ? `${error.message} Please contact an administrator.`
          : "The tag could not be deleted. Please try again."
      );
    } finally {
      setIsDeletingTag(false);
    }
  };

  const handleAutocompleteInputChange = (_event: SyntheticEvent, newInputValue: string) => {
    setSelectedTag(newInputValue);
    const tagColor = getTagColor(newInputValue, tagColors);
    const paletteIndex = colorPalette.indexOf(tagColor);
    setSelectedColor(tagColor);
    setSelectedPaletteIndex(paletteIndex >= 0 ? paletteIndex : null);
  };

  const renderTagSelector = (options: string[], placeholder: string) => (
    <Autocomplete
      freeSolo
      fullWidth
      options={options}
      value={selectedTag}
      onChange={(_event, newValue) => {
        setSelectedTag(newValue);
        const tagColor = getTagColor(newValue || "", tagColors);
        const paletteIndex = colorPalette.indexOf(tagColor);
        setSelectedColor(tagColor);
        setSelectedPaletteIndex(paletteIndex >= 0 ? paletteIndex : null);
      }}
      onInputChange={handleAutocompleteInputChange}
      clearOnEscape
      filterOptions={filterTagOptions}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder}
          variant="outlined"
          fullWidth
          inputProps={{
            ...params.inputProps,
            "aria-label": placeholder,
          }}
        />
      )}
    />
  );

  return (
    <>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          maxHeight: "300px",
          overflowY: "auto",
          flexWrap: "wrap",
          paddingTop: "8px",
          overflow: "visible",
        }}
      >
        {values && values.length > 0
          ? values.map((v: string) => (
              <Box key={v} sx={getTagStyle(v)}>
                <Tag
                  text={v}
                  color={getTagColor(v, tagColors)}
                  handleTag={handleTagWithAnimation}
                  onEdit={handleEditTagClick}
                  values={values}
                  createTag={false}
                  setInnerPopup={setInnerPopup}
                  deleteMode={deleteMode}
                  setTagToDelete={setTagToDelete}
                />
              </Box>
            ))
          : null}
        <Tag
          text={""}
          handleTag={handleTagWithAnimation}
          onEdit={() => undefined}
          values={values}
          createTag={true}
          setInnerPopup={(isOpen: boolean) => {
            if (isOpen) handleCreateTagClick();
          }}
          deleteMode={deleteMode}
          setTagToDelete={setTagToDelete}
        />
      </Box>

      <StyledDialog
        open={Boolean(editingTag)}
        onClose={() => !isSavingEdit && setEditingTag(null)}
        TransitionComponent={Fade}
      >
        <CloseBtn
          aria-label="Close edit tag dialog"
          onClick={() => setEditingTag(null)}
          disabled={isSavingEdit}
        >
          <CloseIcon />
        </CloseBtn>
        <DialogTitle sx={{ pb: 0 }}>
          <SectionTitle>Edit Tag</SectionTitle>
          <Subtitle>Changes to the name or color apply everywhere this tag is used.</Subtitle>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 0.5 }}>
            {editError && <Alert severity="error">{editError}</Alert>}
            <TextField
              label="Tag name"
              value={editedTagName}
              onChange={(event) => setEditedTagName(event.target.value)}
              fullWidth
              autoFocus
              inputProps={{ maxLength: 80 }}
            />
            <Box>
              <Typography component="label" variant="subtitle2" sx={{ fontWeight: 700 }}>
                Predefined colors
              </Typography>
              <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
                You can update multiple predefined colors before saving. Existing tags keep their
                current colors; only this tag uses the selected color.
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mt: 1 }}>
                {colorPalette.map((color, index) => (
                  <Box
                    component="button"
                    type="button"
                    key={index}
                    aria-label={`Select palette color ${index + 1}`}
                    aria-pressed={editedPaletteIndex === index}
                    onClick={() => {
                      setEditedPaletteIndex(index);
                      setEditedTagColor(color);
                    }}
                    sx={{
                      width: 30,
                      height: 30,
                      p: 0,
                      borderRadius: "50%",
                      bgcolor: color,
                      border:
                        editedPaletteIndex === index ? "3px solid #17211f" : "2px solid #ffffff",
                      boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.28)",
                      cursor: "pointer",
                    }}
                  />
                ))}
                <Box
                  component="input"
                  type="color"
                  aria-label="Custom tag color"
                  value={editedTagColor}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    const color = event.target.value;
                    setEditedTagColor(color);
                    if (editedPaletteIndex !== null) {
                      setColorPalette((currentPalette) =>
                        updateTagColorPaletteSlot(currentPalette, editedPaletteIndex, color)
                      );
                    }
                  }}
                  sx={{
                    width: 38,
                    height: 34,
                    p: 0,
                    border: 0,
                    bgcolor: "transparent",
                    cursor: "pointer",
                  }}
                />
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ display: "block", mb: 0.75 }}>
                Preview
              </Typography>
              <Chip
                label={editedTagName.trim() || "Tag preview"}
                sx={{
                  bgcolor: editedTagColor,
                  color: getReadableTagTextColor(editedTagColor),
                  fontWeight: 600,
                }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "flex-end", gap: 1, px: 3, pb: 2 }}>
          <Button onClick={() => setEditingTag(null)} disabled={isSavingEdit}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveTagEdit}
            disabled={isSavingEdit || !editedTagName.trim()}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {isSavingEdit ? "Saving..." : "Save changes"}
          </Button>
        </DialogActions>
      </StyledDialog>

      <StyledDialog
        open={openAddTagModal}
        onClose={() => setOpenAddTagModal(false)}
        TransitionComponent={Fade}
      >
        <CloseBtn aria-label="Close tag dialog" onClick={() => setOpenAddTagModal(false)}>
          <CloseIcon />
        </CloseBtn>
        <DialogTitle sx={{ pb: 0 }}>
          <SectionTitle>{modalMode === "add" ? "Add Tag" : "Remove Tag"}</SectionTitle>
          <Subtitle>
            {modalMode === "add"
              ? "Add a new tag or select from existing ones."
              : "Remove a tag from all profiles. This action cannot be undone."}
          </Subtitle>
        </DialogTitle>
        <DialogContent>
          {modalMode === "add" ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              {addError && <Alert severity="error">{addError}</Alert>}
              {renderTagSelector(availableTags, "Select tag or type new tag")}
              <Box>
                <Typography component="label" variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Predefined colors
                </Typography>
                <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
                  You can update multiple predefined colors before adding the tag. Existing tags
                  keep their current colors.
                </Typography>
                {Boolean(selectedExistingTag) && (
                  <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
                    Existing tags keep their saved color. Use Edit Tag to change it everywhere.
                  </Typography>
                )}
                <Box
                  sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mt: 1 }}
                >
                  {colorPalette.map((color, index) => (
                    <Box
                      component="button"
                      type="button"
                      key={index}
                      aria-label={`Select palette color ${index + 1}`}
                      aria-pressed={selectedPaletteIndex === index}
                      onClick={() => {
                        setSelectedPaletteIndex(index);
                        setSelectedColor(color);
                      }}
                      sx={{
                        width: 30,
                        height: 30,
                        p: 0,
                        borderRadius: "50%",
                        bgcolor: color,
                        border:
                          selectedPaletteIndex === index
                            ? "3px solid #17211f"
                            : "2px solid #ffffff",
                        boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.28)",
                        cursor: "pointer",
                      }}
                    />
                  ))}
                  <Box
                    component="input"
                    type="color"
                    aria-label="Custom tag color"
                    value={selectedColor}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                      const color = event.target.value;
                      setSelectedColor(color);
                      if (selectedPaletteIndex !== null) {
                        setColorPalette((currentPalette) =>
                          updateTagColorPaletteSlot(currentPalette, selectedPaletteIndex, color)
                        );
                      }
                    }}
                    sx={{
                      width: 38,
                      height: 34,
                      p: 0,
                      border: 0,
                      bgcolor: "transparent",
                      cursor: "pointer",
                    }}
                  />
                </Box>
              </Box>
              {selectedTag?.trim() && (
                <Box>
                  <Typography variant="caption" sx={{ display: "block", mb: 0.75 }}>
                    Preview
                  </Typography>
                  <Chip
                    label={selectedTag.trim()}
                    sx={{
                      bgcolor: selectedColor,
                      color: getReadableTagTextColor(selectedColor),
                      fontWeight: 600,
                    }}
                  />
                </Box>
              )}
            </Box>
          ) : (
            renderTagSelector(masterTags, "Select tag to remove")
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between", px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              if (modalMode === "remove") {
                setModalMode("add");
                setSelectedTag(null);
              } else {
                setOpenAddTagModal(false);
              }
            }}
            sx={{ borderRadius: 20, color: "var(--color-primary)", fontWeight: 600 }}
          >
            {modalMode === "remove" ? "Back" : "Cancel"}
          </Button>
          {modalMode === "add" && (
            <AddTagButton
              onClick={handleAddTag}
              disabled={!selectedTag || selectedTag.trim() === ""}
              startIcon={<AddCircleIcon />}
            >
              Add Tag
            </AddTagButton>
          )}
          {modalMode === "remove" && (
            <DeleteButton
              onClick={() => handleRemoveTag(selectedTag || "")}
              disabled={!selectedTag || selectedTag.trim() === ""}
              startIcon={<WarningAmberRoundedIcon />}
            >
              Remove Tag
            </DeleteButton>
          )}
        </DialogActions>
        {/* Move Delete Tag Globally button below actions */}
        {modalMode === "add" && (
          <Box sx={{ px: 3, pb: 2, pt: 0, width: "100%" }}>
            <Button
              variant="outlined"
              color="error"
              sx={{ mt: 1, borderRadius: 20, fontWeight: 600, width: "100%" }}
              onClick={() => setModalMode("remove")}
              startIcon={<WarningAmberRoundedIcon />}
            >
              Delete Tag Globally
            </Button>
          </Box>
        )}
      </StyledDialog>

      {/* Delete Confirmation Dialog */}
      <StyledDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        TransitionComponent={Fade}
      >
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
          <WarningAmberRoundedIcon color="error" fontSize="large" />
          Delete Tag?
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
            Deleting this tag will erase it from <b>ALL PROFILES</b>.<br />
            Are you sure you want to proceed?
          </Typography>
          {deleteError && <Alert severity="error">{deleteError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", gap: 2, pb: 2 }}>
          <DeleteButton onClick={confirmRemoveTag} variant="contained" disabled={isDeletingTag}>
            {isDeletingTag ? "Deleting..." : "Delete Tag"}
          </DeleteButton>
          <Button
            onClick={() => setShowDeleteConfirm(false)}
            disabled={isDeletingTag}
            sx={{ borderRadius: 20, color: "var(--color-primary)", fontWeight: 600 }}
          >
            Cancel{" "}
          </Button>
        </DialogActions>
      </StyledDialog>

      {/* Delete Success Dialog */}
      <StyledDialog
        open={showDeleteSuccess}
        onClose={() => {
          setShowDeleteSuccess(false);
          setTagToDeleteState(null);
        }}
        TransitionComponent={Fade}
      >
        <DialogTitle
          sx={{
            textAlign: "center",
            color: "#2e7d32",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
          }}
        >
          <CheckCircleIcon color="success" fontSize="large" />
          Tag Deleted Successfully!
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
          {" "}
          <Typography sx={{ color: "var(--color-text-secondary)" }}>
            The tag <b>&ldquo;{tagToDelete}&rdquo;</b> has been successfully deleted from all
            profiles.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
          <Button
            onClick={() => {
              setShowDeleteSuccess(false);
              setTagToDeleteState(null);
            }}
            variant="contained"
            sx={{
              background: "var(--color-primary)",
              borderRadius: 20,
              fontWeight: 600,
              "&:hover": {
                background: "#1e6656",
              },
            }}
          >
            OK
          </Button>
        </DialogActions>
      </StyledDialog>
    </>
  );
}
