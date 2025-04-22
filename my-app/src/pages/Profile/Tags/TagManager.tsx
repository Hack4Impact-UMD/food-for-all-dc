import { useState, useEffect } from 'react';
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
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import CloseIcon from '@mui/icons-material/Close';
import { doc, setDoc, getDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../../auth/firebaseConfig';

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

export default function TagManager({ allTags, values, handleTag, setInnerPopup, deleteMode, setTagToDelete, clientUid }: TagsProps) {
  const [masterTags, setMasterTags] = useState<string[]>(allTags);
  useEffect(() => {
    setMasterTags(allTags);
  }, [allTags]);

  // Function to refresh tags directly from Firebase
  const refreshMasterTags = async () => {
    try {
      const docRef = doc(db, "tags", "oGuiR2dQQeOBXHCkhDeX");
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
  const [tagToDelete, setTagToDeleteState] = useState<string | null>(null);

  // Filter already applied tags (for adding)
  const availableTags = masterTags.filter((tag: string) => !values.includes(tag));

  const handleCreateTagClick = () => {
    setModalMode("add");
    setSelectedTag(null);
    setOpenAddTagModal(true);
  };

  // Adding tags: update both the client (Firebase record) and master tags if the tag is new
  const handleAddTag = async () => {
    if (selectedTag && selectedTag.trim() !== "") {
      handleTag(selectedTag);
      const newClientTags = [...values, selectedTag].sort((a, b) => a.localeCompare(b));
      try {
        await setDoc(doc(db, "clients", clientUid), { tags: newClientTags }, { merge: true });
      } catch (error) {
        console.error("Error updating client tags in Firebase:", error);
      }
      if (!masterTags.includes(selectedTag)) {
        const newAllTags = [...masterTags, selectedTag].sort((a, b) => a.localeCompare(b));
        try {
          await setDoc(
            doc(db, "tags", "oGuiR2dQQeOBXHCkhDeX"),
            { tags: newAllTags },
            { merge: true }
          );
          setMasterTags(newAllTags);
        } catch (error) {
          console.error("Error updating tags in Firebase:", error);
        }
      }
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
    const newAllTags = masterTags.filter((tag: string) => tag !== tagToDelete);
    try {
      await setDoc(
        doc(db, "tags", "oGuiR2dQQeOBXHCkhDeX"),
        { tags: newAllTags },
        { merge: true }
      );
      setMasterTags(newAllTags);
      const clientsRef = collection(db, "clients");
      const q = query(clientsRef, where("tags", "array-contains", tagToDelete));
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      querySnapshot.forEach((docSnap) => {
        const clientData = docSnap.data();
        const currentTags: string[] = clientData.tags || [];
        const updatedTags = currentTags.filter(tag => tag !== tagToDelete);
        const clientDocRef = doc(db, "clients", docSnap.id);
        batch.update(clientDocRef, { tags: updatedTags });
      });
      await batch.commit();
      if (values.includes(tagToDelete)) {
        handleTag(tagToDelete);
      }
    } catch (error) {
      console.error("Error removing tag from Firebase:", error);
    }
    setShowDeleteConfirm(false);
    setTagToDeleteState(null);
    setModalMode("add");
    setSelectedTag(null);
  };

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
          <Tag 
            key={v}
            text={v} 
            handleTag={handleTag} 
            values={values} 
            createTag={false} 
            setInnerPopup={setInnerPopup} 
            deleteMode={deleteMode} 
            setTagToDelete={setTagToDelete}
          />
        )) : null}
        <Box
          onClick={handleCreateTagClick}
          sx={{ cursor: 'pointer' }}
        >
          <Tag 
            text={""} 
            handleTag={handleTag} 
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
          {modalMode === "add" ? (
            <>
              <Autocomplete
                freeSolo
                options={availableTags}
                value={selectedTag}
                onChange={(_event, newValue) => setSelectedTag(newValue)}
                onInputChange={(_event, newInputValue) => setSelectedTag(newInputValue)}
                renderInput={(params) => <TextField {...params} label="Select tag or type new tag" variant="standard" />}
                clearOnEscape
                filterOptions={(options, state) => {
                  // Default filter, then limit to 10
                  const filtered = options.filter(option =>
                    option.toLowerCase().includes(state.inputValue.toLowerCase())
                  );
                  return filtered.slice(0, 10);
                }}
              />
            </>
          ) : (
            <Autocomplete
              freeSolo
              options={masterTags}
              value={selectedTag}
              onChange={(_event, newValue) => setSelectedTag(newValue)}
              renderInput={(params) => <TextField {...params} label="Select tag to remove" variant="standard" />}
              clearOnEscape
              filterOptions={(options, state) => {
                const filtered = options.filter(option =>
                  option.toLowerCase().includes(state.inputValue.toLowerCase())
                );
                return filtered.slice(0, 10);
              }}
            />
          )}
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
            Cancel
          </Button>
        </DialogActions>
      </StyledDialog>
    </>
  );
}
