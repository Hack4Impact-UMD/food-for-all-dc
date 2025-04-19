import { Box, IconButton, Tooltip, Typography, Avatar, Divider, Chip, styled } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import PersonIcon from "@mui/icons-material/Person";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import DateRangeIcon from "@mui/icons-material/DateRange";
import React from "react";
import Tags from "../Tags/Tags";

// Header wrapper that extends to the top of the page
const HeaderWrapper = styled(Box)({
  backgroundColor: "white",
  width: "100%",
  position: "relative",
  marginBottom: "20px",
  zIndex: 1, // Ensure it sits above background elements
});

// Styled components for enhanced header
const HeaderContainer = styled(Box)(({ theme }) => ({
  backgroundColor: "white",
  borderRadius: "0 0 12px 12px",
  boxShadow: "0 3px 10px rgba(0, 0, 0, 0.08)",
  padding: "48px 32px 24px 32px",
  transition: "all 0.3s ease",
  "&:hover": {
    boxShadow: "0 5px 15px rgba(0, 0, 0, 0.12)",
  },
}));

const NameWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  marginBottom: "16px",
}));

const ProfileName = styled(Typography)(({ theme }) => ({
  fontSize: "1.75rem",
  fontWeight: 600,
  marginLeft: "16px",
  position: "relative",
  "&:after": {
    content: '""',
    position: "absolute",
    bottom: "-8px",
    left: "0",
    width: "40px",
    height: "3px",
    backgroundColor: "var(--color-primary)",
    borderRadius: "2px",
    transition: "width 0.3s ease",
  },
  "&:hover:after": {
    width: "100%",
  },
}));

const StyledAvatar = styled(Avatar)(({ theme }) => ({
  backgroundColor: "var(--color-primary)",
  width: "64px",
  height: "64px",
  fontSize: "28px",
  boxShadow: "0 3px 8px rgba(37, 126, 104, 0.2)",
  transition: "transform 0.3s ease",
  "&:hover": {
    transform: "scale(1.05)",
  },
}));

const TagsContainer = styled(Box)(({ theme }) => ({
  marginTop: "16px",
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  alignItems: "center",
}));

const OverviewLabel = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: "8px 16px",
  backgroundColor: "rgba(37, 126, 104, 0.08)",
  borderRadius: "20px",
  marginTop: "16px",
  color: "var(--color-primary)",
  cursor: "default",
  transition: "transform 0.2s ease, background-color 0.2s ease",
  "&:hover": {
    transform: "translateY(-2px)",
    backgroundColor: "rgba(37, 126, 104, 0.12)",
  },
}));

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
  // Get initials for avatar
  const getInitials = () => {
    const first = firstName ? firstName.charAt(0).toUpperCase() : "";
    const last = lastName ? lastName.charAt(0).toUpperCase() : "";
    return first + last || "?";
  };

  // Format name for display
  const displayName = () => {
    return firstName?.trim() || lastName?.trim()
      ? `${firstName || ""} ${lastName || ""}`.trim()
      : "New Client";
  };

  // No-op function that satisfies eslint
  const noOp = (param: any) => {
    // Intentionally empty, used as a placeholder for required props
    return;
  };

  return (
    <HeaderWrapper>
      <HeaderContainer>
        <NameWrapper>
          <StyledAvatar>{getInitials()}</StyledAvatar>
          <Box sx={{ ml: 2 }}>
            <ProfileName variant="h4">
              {displayName()}
            </ProfileName>
            <Box sx={{ display: "flex", alignItems: "center", mt: 1, color: "var(--color-text-secondary)" }}>
              <PersonIcon fontSize="small" sx={{ mr: 0.5 }} />
              <Typography variant="body2">
                ID: {clientId || "Not assigned yet"}
              </Typography>
            </Box>
          </Box>
        </NameWrapper>

        <Divider sx={{ mb: 2 }} />

        {clientId && (
          <TagsContainer>
            <Chip 
              label="Tags" 
              color="primary" 
              variant="outlined" 
              size="small" 
              sx={{ mr: 1, backgroundColor: "rgba(37, 126, 104, 0.05)" }} 
            />
            <Tags
              allTags={allTags}
              values={tags}
              handleTag={handleTag}
              setInnerPopup={noOp}
              deleteMode={false}
              setTagToDelete={noOp}
              clientUid={clientId}
            />
          </TagsContainer>
        )}

        <OverviewLabel>
          <PersonIcon sx={{ mr: 1 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, letterSpacing: "0.5px" }}>
            CLIENT OVERVIEW
          </Typography>
        </OverviewLabel>
      </HeaderContainer>
    </HeaderWrapper>
  );
};

export default ProfileHeader;