import { useState, useEffect, SyntheticEvent } from 'react';
import Tag from './Tag';
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
  Fade,
  IconButton,
  styled,
  FilterOptionsState,
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import { doc, setDoc, getDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import dataSources from '../../../config/dataSources';
import { db } from '../../../auth/firebaseConfig';

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
  handleTag: (tag: string) => void;
  setInnerPopup: (isOpen: boolean) => void;
  deleteMode: boolean;
  setTagToDelete: (tag: string | null) => void;
  clientUid: string; // new prop to update client firebase record
}

export const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiPaper-root': {
    borderRadius: 18,
    boxShadow: '0 8px 32px rgba(37, 126, 104, 0.18)',
    padding: theme.spacing(2, 2, 2, 2),
    maxWidth: 480,
    width: '100%',
    background: '#fff',
    position: 'relative',
  },
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '1.35rem',
  color: 'var(--color-primary)',
  letterSpacing: 0.5,
  marginBottom: theme.spacing(0.5),
}));

const Subtitle = styled(Typography)(({ theme }) => ({
  color: 'var(--color-text-secondary)',
  fontSize: '1rem',
  marginBottom: theme.spacing(2),
}));

const TagGrid = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1.2),
  margin: theme.spacing(1, 0, 2, 0),
  justifyContent: 'flex-start',
}));

const AddTagButton = styled(Button)(({ theme }) => ({
  background: 'var(--color-primary)',
  color: '#fff',
  borderRadius: 20,
  fontWeight: 600,
  textTransform: 'none',
  boxShadow: '0 2px 8px rgba(37, 126, 104, 0.10)',
  '&:hover': {
    background: '#1e6656',
  },
  marginLeft: theme.spacing(1),
}));

const DeleteButton = styled(Button)(({ theme }) => ({
  background: '#e53935',
  color: '#fff',
  borderRadius: 20,
  fontWeight: 600,
  textTransform: 'none',
  '&:hover': {
    background: '#b71c1c',
  },
}));

const CloseBtn = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  right: theme.spacing(1),
  top: theme.spacing(1),
  color: 'var(--color-text-secondary)',
  zIndex: 2,
}));

const filterTagOptions = (options: string[], { inputValue }: FilterOptionsState<string>) =>
  options
    .filter(option => option.toLowerCase().includes(inputValue.toLowerCase()))
    .slice(0, 10);

export default function TagManager({ allTags, values, handleTag, setInnerPopup, deleteMode, setTagToDelete, clientUid }: TagsProps) {
  const [masterTags, setMasterTags] = useState<string[]>(allTags);
  
  // Animation states - similar to delivery animations
  const [tagsWithAnimation, setTagsWithAnimation] = useState<TagWithAnimation[]>([]);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);
  const [addingTagId, setAddingTagId] = useState<string | null>(null);
  
  useEffect(() => {
    setMasterTags(allTags);
    // Initialize tags with animation data
    setTagsWithAnimation(values.map(tag => ({ id: tag, text: tag, hidden: false })));
  }, [allTags, values]);

  // Function to refresh tags directly from Firebase
  const refreshMasterTags = async () => {
    try {
  const docRef = doc(db, dataSources.firebase.tagsCollection, dataSources.firebase.tagsDocId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if(data && data.tags) {
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
  const [modalMode, setModalMode] = useState<"add" | "remove">("add");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [tagToDelete, setTagToDeleteState] = useState<string | null>(null);

  // Filter already applied tags (for adding)
  const availableTags = masterTags.filter((tag: string) => !values.includes(tag));

  // Animation helper function - similar to delivery components
  const getTagStyle = (tagId: string) => {
    const animatedTag = tagsWithAnimation.find(t => t.id === tagId);
    
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
    setOpenAddTagModal(true);
  };

  // Enhanced handleTag wrapper with animations
  const handleTagWithAnimation = (tagText: string) => {
    const isRemoving = values.includes(tagText);
    
    if (isRemoving) {
      // Set up removal animation
      setDeletingTagId(tagText);
      
      // Update animation state to mark as deleting
      setTagsWithAnimation(prev => 
        prev.map(tag => 
          tag.id === tagText 
            ? { ...tag, isDeleting: true, hidden: true }
            : tag
        )
      );
      
      // Delay the actual removal to allow animation
      setTimeout(() => {
        handleTag(tagText); // Call the original handleTag
        
        // Clean up animation state after removal
        setTimeout(() => {
          setDeletingTagId(null);
          setTagsWithAnimation(prev => 
            prev.filter(tag => tag.id !== tagText)
          );
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
      // Set up animation state for the new tag
      const newTagId = selectedTag.trim();
      setAddingTagId(newTagId);
      
      // Add to local animation state immediately with hidden: true
      setTagsWithAnimation(prev => [
        ...prev,
        { id: newTagId, text: newTagId, hidden: true, isAdding: true }
      ]);
      
      // Let handleTag function handle the client's tag update in Firebase
      handleTag(selectedTag);
      
      // Only update the master tags list if it's a new tag
      if (!masterTags.includes(selectedTag)) {
        const newAllTags = [...masterTags, selectedTag].sort((a, b) => a.localeCompare(b));
        try {
          await setDoc(
            doc(db, dataSources.firebase.tagsCollection, dataSources.firebase.tagsDocId),
            { tags: newAllTags },
            { merge: true }
          );
          setMasterTags(newAllTags);
        } catch (error) {
          console.error("Error updating tags in Firebase:", error);
        }
      }
      
      // Animate the new tag in after a brief delay
      setTimeout(() => {
        setTagsWithAnimation(prev => 
          prev.map(tag => 
            tag.id === newTagId 
              ? { ...tag, hidden: false, isAdding: true }
              : tag
          )
        );
        
        // Clear animation state after animation completes
        setTimeout(() => {
          setAddingTagId(null);
          setTagsWithAnimation(prev => 
            prev.map(tag => 
              tag.id === newTagId 
                ? { ...tag, isAdding: false }
                : tag
            )
          );
        }, 500); // Match animation duration
      }, 100);
      
      setSelectedTag(null);
      setOpenAddTagModal(false);
    }
  };

  // Removing tags from the master collection AND from all clients 
  const handleRemoveTag = async (tagToRemove: string) => {
    setTagToDeleteState(tagToRemove);
    setShowDeleteConfirm(true);
  };
  
  const confirmRemoveTag = async () => {
    if (!tagToDelete) return;
    const deletedTagName = tagToDelete; // Store the tag name for success message
    const newAllTags = masterTags.filter((tag: string) => tag !== tagToDelete);
    try {
      await setDoc(
  doc(db, dataSources.firebase.tagsCollection, dataSources.firebase.tagsDocId),
        { tags: newAllTags },
        { merge: true }
      );
      setMasterTags(newAllTags);
  const clientsRef = collection(db, dataSources.firebase.clientsCollection);
      const q = query(clientsRef, where("tags", "array-contains", tagToDelete));
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      querySnapshot.forEach((docSnap) => {
        const clientData = docSnap.data();
        const currentTags: string[] = clientData.tags || [];
        const updatedTags = currentTags.filter(tag => tag !== tagToDelete);
  const clientDocRef = doc(db, dataSources.firebase.clientsCollection, docSnap.id);
        batch.update(clientDocRef, { tags: updatedTags });
      });
      await batch.commit();
      if (values.includes(tagToDelete)) {
        handleTag(tagToDelete);
      }
      
      // Show success dialog after successful deletion
      setShowDeleteConfirm(false);
      setTagToDeleteState(deletedTagName); // Keep the tag name for the success message
      setShowDeleteSuccess(true);
      setModalMode("add");
      setSelectedTag(null);
    } catch (error) {
      console.error("Error removing tag from Firebase:", error);
      setShowDeleteConfirm(false);
      setTagToDeleteState(null);
      setModalMode("add");
      setSelectedTag(null);
    }
  };

  const handleAutocompleteInputChange = (_event: SyntheticEvent, newInputValue: string) => {
    setSelectedTag(newInputValue);
  };

  const renderTagSelector = (options: string[], placeholder: string) => (
    <Autocomplete
      freeSolo
      fullWidth
      options={options}
      value={selectedTag}
      onChange={(_event, newValue) => setSelectedTag(newValue)}
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
            'aria-label': placeholder,
          }}
        />
      )}
    />
  );

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          maxHeight: '300px',
          overflowY: 'auto',
          flexWrap: 'wrap',
          paddingTop: '8px',
          overflow: 'visible',
        }}
      >
        {values && values.length > 0 ? values.map((v: string) => (
          <Box key={v} sx={getTagStyle(v)}>
            <Tag 
              text={v} 
              handleTag={handleTagWithAnimation} 
              values={values} 
              createTag={false} 
              setInnerPopup={setInnerPopup} 
              deleteMode={deleteMode} 
              setTagToDelete={setTagToDelete}
            />
          </Box>
        )) : null}
        <Box
          onClick={handleCreateTagClick}
          sx={{ cursor: 'pointer' }}
        >
          <Tag 
            text={""} 
            handleTag={handleTagWithAnimation} 
            values={values} 
            createTag={true} 
            setInnerPopup={(isOpen: boolean) => { /* no-op: not needed here */ }}
            deleteMode={deleteMode} 
            setTagToDelete={setTagToDelete}
          />
        </Box>
      </Box>

      <StyledDialog
        open={openAddTagModal}
        onClose={() => setOpenAddTagModal(false)}
        TransitionComponent={Fade}
      >
        <CloseBtn onClick={() => setOpenAddTagModal(false)}><CloseIcon /></CloseBtn>
        <DialogTitle sx={{ pb: 0 }}>
          <SectionTitle>
            {modalMode === "add" ? "Add Tag" : "Remove Tag"}
          </SectionTitle>
          <Subtitle>
            {modalMode === "add"
              ? "Add a new tag or select from existing ones."
              : "Remove a tag from all profiles. This action cannot be undone."}
          </Subtitle>
        </DialogTitle>
        <DialogContent>
          {modalMode === "add"
            ? renderTagSelector(availableTags, "Select tag or type new tag")
            : renderTagSelector(masterTags, "Select tag to remove")}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Button onClick={() => {
            if (modalMode === 'remove') {
              setModalMode('add');
              setSelectedTag(null);
            } else {
              setOpenAddTagModal(false);
            }
          }} sx={{ borderRadius: 20, color: 'var(--color-primary)', fontWeight: 600 }}>
            {modalMode === 'remove' ? 'Back' : 'Cancel'}
          </Button>
          {modalMode === "add" && (
            <AddTagButton onClick={handleAddTag} disabled={!selectedTag || selectedTag.trim() === ""} startIcon={<AddCircleIcon />}>
              Add Tag
            </AddTagButton>
          )}
          {modalMode === "remove" && (
            <DeleteButton onClick={() => handleRemoveTag(selectedTag || "")} disabled={!selectedTag || selectedTag.trim() === ""} startIcon={<WarningAmberRoundedIcon />}>
              Remove Tag
            </DeleteButton>
          )}
        </DialogActions>
        {/* Move Delete Tag Globally button below actions */}
        {modalMode === "add" && (
          <Box sx={{ px: 3, pb: 2, pt: 0, width: '100%' }}>
            <Button
              variant="outlined"
              color="error"
              sx={{ mt: 1, borderRadius: 20, fontWeight: 600, width: '100%' }}
              onClick={() => setModalMode('remove')}
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
        <DialogTitle sx={{ textAlign: "center", color: '#e53935', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <WarningAmberRoundedIcon color="error" fontSize="large" />
          Delete Tag?
        </DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            minWidth: 320,
            textAlign: "center",
          }}
        >
          <Typography sx={{ color: 'var(--color-text-secondary)' }}>
            Deleting this tag will erase it from <b>ALL PROFILES</b>.<br />
            Are you sure you want to proceed?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 2 }}>
          <DeleteButton
            onClick={confirmRemoveTag}
            variant="contained"
          >
            Delete Tag
          </DeleteButton>
          <Button
            onClick={() => setShowDeleteConfirm(false)}
            sx={{ borderRadius: 20, color: 'var(--color-primary)', fontWeight: 600 }}
          >
            Cancel          </Button>
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
        <DialogTitle sx={{ textAlign: "center", color: '#2e7d32', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon color="success" fontSize="large" />
          Tag Deleted Successfully!
        </DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            minWidth: 320,
            textAlign: "center",
          }}
        >          <Typography sx={{ color: 'var(--color-text-secondary)' }}>
            The tag <b>&ldquo;{tagToDelete}&rdquo;</b> has been successfully deleted from all profiles.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button
            onClick={() => {
              setShowDeleteSuccess(false);
              setTagToDeleteState(null);
            }}
            variant="contained"
            sx={{ 
              background: 'var(--color-primary)', 
              borderRadius: 20, 
              fontWeight: 600,
              '&:hover': {
                background: '#1e6656',
              }
            }}
          >
            OK
          </Button>
        </DialogActions>
      </StyledDialog>
    </>
  );
}
