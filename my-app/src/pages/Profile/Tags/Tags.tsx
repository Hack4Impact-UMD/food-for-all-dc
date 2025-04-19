import { useState, useEffect } from 'react';
import Tag from './Tag';
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Autocomplete } from '@mui/material';
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

export default function Tags({ allTags, values, handleTag, setInnerPopup, deleteMode, setTagToDelete, clientUid }: TagsProps) {
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
      // Update client in-memory tags via provided function
      handleTag(selectedTag);

      // Update the client's Firebase record with the new tag list
      const newClientTags = [...values, selectedTag].sort((a, b) => a.localeCompare(b));
      try {
        await setDoc(doc(db, "clients", clientUid), { tags: newClientTags }, { merge: true });
      } catch (error) {
        console.error("Error updating client tags in Firebase:", error);
      }

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

  // Removing tags from the master collection AND from all clients 
  const handleRemoveTag = async (tagToRemove: string) => {
    const newAllTags = masterTags.filter((tag: string) => tag !== tagToRemove);
    try {
      // Update the master tags document
      await setDoc(
        doc(db, "tags", "oGuiR2dQQeOBXHCkhDeX"),
        { tags: newAllTags },
        { merge: true }
      );
      setMasterTags(newAllTags);
      console.log(`Tag "${tagToRemove}" removed from the master collection.`);
      
      // Remove the tag from all client documents that have the tag
      const clientsRef = collection(db, "clients");
      const q = query(clientsRef, where("tags", "array-contains", tagToRemove));
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      querySnapshot.forEach((docSnap) => {
        const clientData = docSnap.data();
        const currentTags: string[] = clientData.tags || [];
        const updatedTags = currentTags.filter(tag => tag !== tagToRemove);
        const clientDocRef = doc(db, "clients", docSnap.id);
        batch.update(clientDocRef, { tags: updatedTags });
      });
      await batch.commit();
      console.log(`Tag "${tagToRemove}" removed from all client documents.`);

      // If the current client's tags include the removed tag, toggle it off so the header updates.
      if (values.includes(tagToRemove)) {
        handleTag(tagToRemove);
      }
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
            <Button onClick={handleAddTag} disabled={!selectedTag || selectedTag.trim() === ""}>Add Tag</Button>
          )}
          {/* TODO: Reimplement tag removal from master list functionality here. */}
          {/* Need to decide if we want a separate remove button or handle it via Autocomplete */}
        </DialogActions>
      </Dialog>
    </>
  );
}
