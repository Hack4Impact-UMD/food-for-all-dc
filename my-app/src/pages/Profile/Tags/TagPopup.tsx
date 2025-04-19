import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Input,
  Typography,
} from "@mui/material";
import { useState } from "react";
import Tags from "./Tags";

export default function TagPopup({ allTags, tags, handleTag, isModalOpen, setIsModalOpen }: any) {
  const [innerPopup, setInnerPopup] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [deleteMode, setDeleteMode] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);

  const addNewTag = (text: string) => {
    text = text.trim();
    if (text !== "" && !allTags.includes(text)) {
      allTags.push(text);
    }
  };

  const deleteTag = async (text: string) => {
    text = text.trim();
    if (text !== "") {
      const index = allTags.indexOf(text);
      allTags.splice(index, 1);
      if (tags.includes(text)) {
        const index = tags.indexOf(text);
        tags.splice(index, 1);
      }
    }
  };
  return (
    <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)}>
      {/* All tags display*/}
      <DialogTitle>Edit Tags</DialogTitle>
      <DialogContent>
        <Tags
          allTags={allTags}
          values={tags}
          handleTag={handleTag}
          setInnerPopup={setInnerPopup}
          deleteMode={deleteMode}
          setTagToDelete={setTagToDelete}
          clientUid='Apple'
        ></Tags>
      </DialogContent>

      <DialogContent sx={{ display: "flex", gap: "10px", maxWidth: "100%", flexWrap: "wrap" }}>
        <p>Selected Tags: </p>
        {tags.length > 0 ? (
          tags.map((tag: any, index: number) => (
            <p key={tag}>
              {tag}
              {index !== tags.length - 1 && ", "}
            </p>
          ))
        ) : (
          <p>No tags selected.</p>
        )}
      </DialogContent>

      {/* Create or delete tag from db*/}
      <DialogContent
        sx={{
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          padding: "10px",
        }}
      >
        <Button
          variant="contained"
          // startIcon={<Add />}
          onClick={() => {
            setDeleteMode(!deleteMode);
          }}
          sx={{
            flex: 1,
            color: "#fff",
            backgroundColor: "#257E68",
          }}
        >
          {deleteMode ? "Cancel" : "Delete tag"}
        </Button>
        <Button
          variant="contained"
          onClick={() => setIsModalOpen(false)}
          sx={{
            flex: 1,
            color: "#fff",
            backgroundColor: "#257E68",
          }}
        >
          DONE
        </Button>
      </DialogContent>

      {/* Create new tag */}
      <Dialog
        open={innerPopup && !deleteMode}
        onClose={() => {
          setInnerPopup(false);
          setNewTag("");
        }}
      >
        <DialogTitle>Create New Tag</DialogTitle>
        <DialogContent sx={{ display: "flex", gap: "10px", maxWidth: "100%", flexWrap: "wrap" }}>
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            sx={{ width: "300px" }}
            className="login-input-field"
            placeholder="New Tag"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setInnerPopup(false);
              addNewTag(newTag);
              setNewTag("");
            }}
          >
            DONE
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={innerPopup && deleteMode}
        onClose={() => {
          setInnerPopup(false);
          setNewTag("");
        }}
      >
        <DialogTitle sx={{ textAlign: "center" }}>WARNING</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            gap: "10px",
            maxWidth: "100%",
            flexWrap: "wrap",
            textAlign: "center",
          }}
        >
          <Typography>
            Deleting this tag will erase if from ALL PROFILES. If you want to deselect it just for
            this profile, click &quot;CANCEL&quot; and just click the tag. <br></br> <br></br> Are you sure
            you want to proceed?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            sx={{ backgroundColor: "red !important" }}
            onClick={() => {
              setInnerPopup(false);
              if (tagToDelete) {
                deleteTag(tagToDelete);
              }
              setTagToDelete(null);
              setDeleteMode(false);
            }}
          >
            DELETE TAG
          </Button>
          <Button
            onClick={() => {
              setInnerPopup(false);
              setDeleteMode(false);
            }}
          >
            CANCEL
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
