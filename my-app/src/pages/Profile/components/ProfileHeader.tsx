import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import PersonIcon from "@mui/icons-material/Person";
import React from "react";
import Tags from "../Tags/Tags";

interface ProfileHeaderProps {
  firstName: string;
  lastName: string;
  isEditing: boolean;
  tags: string[];
  allTags: string[];
  handleTag: (tag: string) => void;
  clientId: string | null;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  firstName,
  lastName,
  isEditing,
  tags,
  allTags,
  handleTag,
  clientId,
}) => {
  return (
    <Box className="white-container">
      <Box display="flex" alignItems="center" style={{ marginBottom: 20 }}>
        <Typography variant="h5" className="border-bottom" style={{ marginRight: 8 }}>
          {firstName?.trim() || lastName?.trim()
            ? `${firstName || ""} ${lastName || ""}`.trim()
            : "Welcome!"}
        </Typography>
        {clientId && (
          <Tags
            allTags={allTags}
            values={tags}
            handleTag={handleTag}
            setInnerPopup={() => {}}
            deleteMode={false}
            setTagToDelete={() => {}}
            clientUid={clientId}
          />
        )}
      </Box>
      <Box
        display="flex"
        alignItems="center"
        borderBottom="2px solid green"
        pb={0.5}
        sx={{ width: "min-content" }}
      >
        <PersonIcon style={{ marginRight: 3, color: "green" }} />
        <Typography variant="body1" sx={{ fontWeight: 800, color: "green" }}>
          OVERVIEW
        </Typography>
      </Box>
    </Box>
  );
};

export default ProfileHeader;