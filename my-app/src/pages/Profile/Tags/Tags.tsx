import { useState, useEffect } from 'react';
import Tag from './Tag';
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Autocomplete } from '@mui/material';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../auth/firebaseConfig';

export default function Tags({ allTags, values, handleTag, setInnerPopup, deleteMode, setTagToDelete }: any) {
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

  // Filter already applied tags
  const availableTags = masterTags.filter((tag: string) => !values.includes(tag));

  const handleCreateTagClick = () => {
    setModalMode("add");
    setSelectedTag(null);
    setOpenAddTagModal(true);
  };

  // Adding tags
  const handleAddTag = async () => {
    if (selectedTag && selectedTag.trim() !== "") {
      handleTag(selectedTag);

      // If the tag does not exist in the master list, update Firebase with the new tag and update local state
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

  // Removing tags
  const handleRemoveTag = async (tagToRemove: string) => {
    const newAllTags = masterTags.filter((tag: string) => tag !== tagToRemove);
    try {
      await setDoc(
        doc(db, "tags", "oGuiR2dQQeOBXHCkhDeX"),
        { tags: newAllTags },
        { merge: true }
      );
      setMasterTags(newAllTags);
      console.log(`Tag "${tagToRemove}" removed from the master collection.`);
    } catch (error) {
      console.error("Error removing tag from Firebase:", error);
    }
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
          paddingTop: deleteMode ? '10px' : '0px',
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
            setInnerPopup={() => {}} 
            deleteMode={deleteMode} 
            setTagToDelete={setTagToDelete}
          />
        </Box>
      </Box>

      <Dialog
        open={openAddTagModal}
        onClose={() => setOpenAddTagModal(false)}
      >
        <DialogTitle>{modalMode === "add" ? "Add Tag" : "Remove Tag"}</DialogTitle>
        <DialogContent>
          {modalMode === "add" ? (
            <Autocomplete
              freeSolo
              options={availableTags}
              value={selectedTag}
              onChange={(_event, newValue) => setSelectedTag(newValue)}
              onInputChange={(_event, newInputValue) => setSelectedTag(newInputValue)}
              renderInput={(params) => <TextField {...params} label="Select tag or type new tag" variant="standard" />}
              clearOnEscape
            />
          ) : (
            // In remove mode, use a dropdown to select a tag to remove from the master collection
            <Autocomplete
              freeSolo
              options={masterTags}
              value={selectedTag}
              onChange={(_event, newValue) => setSelectedTag(newValue)}
              renderInput={(params) => <TextField {...params} label="Select tag to remove" variant="standard" />}
              clearOnEscape
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddTagModal(false)}>Cancel</Button>
          {modalMode === "add" && (
            <Button onClick={handleAddTag} disabled={!selectedTag || selectedTag.trim() === ""}>Add</Button>
          )}
          {modalMode === "remove" && (
            <Button onClick={() => {
              if (selectedTag) {
                handleRemoveTag(selectedTag);
                setSelectedTag(null);
                setOpenAddTagModal(false);
              }
            }} disabled={!selectedTag}>
              Remove
            </Button>
          )}
          <Button 
            onClick={async () => {
              if (modalMode === "add") {
                setModalMode("remove");
                setSelectedTag(null);
                await refreshMasterTags();
              } else {
                setModalMode("add");
                setSelectedTag(null);
              }
            }}
          >
            {modalMode === "add" ? "Remove Mode" : "Add Mode"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}  
