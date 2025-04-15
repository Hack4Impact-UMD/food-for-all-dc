import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { Box, Tooltip, Typography } from "@mui/material";
import { styled } from "@mui/system";
import React, { useState } from "react";

interface TagProps {
  text: string;
  handleTag: (text: string) => void;
  setInnerPopup: (isOpen: boolean) => void;
  values: string[];
  createTag: boolean;
  deleteMode: boolean;
  setTagToDelete: (tag: string) => void;
}

// Styled component for the tag container with a transition effect
const TagContainer = styled(Box)(({ theme }) => ({
  backgroundColor: "#e0e0e0",
  textAlign: "center",
  borderRadius: "5px",
  padding: "6px 12px",
  minWidth: "60px",
  minHeight: "30px",
  cursor: "pointer",
  transition: "background-color 0.3s ease",
  "&:hover": {
    backgroundColor: "#bdbdbd",
  },
  "&.active": {
    backgroundColor: "#257E68",
    color: "#fff",
  },
}));

const CreateTagContainer = styled(Box)(({ theme }) => ({
  backgroundColor: "white",
  borderRadius: "5px",
  padding: "6px 12px",
  cursor: "pointer",
  border: "1px dashed lightgray",
  transition: "background-color 0.3s ease",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "60px",
  minHeight: "30px",
  position: "relative",
  "&:hover": {
    backgroundColor: "#f3f3f3",
  },
}));

const Tag: React.FC<TagProps> = ({
  text,
  handleTag,
  values,
  createTag,
  setInnerPopup,
  deleteMode,
  setTagToDelete,
}) => {
  const handleClick = () => {
    handleTag(text);
  };

  if (!deleteMode) {
    return !createTag ? (
      <TagContainer className={values.includes(text) ? "active" : ""} onClick={handleClick}>
        <Typography variant="body1">{text}</Typography>
      </TagContainer>
    ) : (
      <Tooltip title={"Create a new tag"} placement="top">
        <CreateTagContainer
          className={values.includes(text) ? "active" : ""}
          onClick={() => {
            setInnerPopup(true);
          }}
        >
          <AddIcon
            sx={{
              fontSize: "20px",
              color: "#257E68",
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
        <Typography variant="body1">{text}</Typography>
        <CloseIcon
          sx={{
            position: "absolute",
            top: -7,
            right: -8,
            backgroundColor: "white",
            color: "red",
            boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.2)",
            borderRadius: "50%",
            width: "20px",
            height: "20px",
            "&:hover": {
              backgroundColor: "lightgray",
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
