import { Box, Typography, Avatar, Divider, Chip, styled, Stack } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import React from "react";
import Tags from "../Tags/Tags";

// Simplified Header Container
const ModernHeaderContainer = styled(Box)(({ theme }) => ({
  backgroundColor: "white",
  borderRadius: "12px", // Slightly softer radius
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)", // Subtle shadow
  padding: theme.spacing(7, 4, 3, 4), // Reduced top padding (Top, Right, Bottom, Left)
  marginBottom: theme.spacing(3),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(3), // Gap between avatar and info
  width: '100%', // Ensure it takes full width within its container
}));

// Styled components for enhanced header (Keep Avatar, adjust others if needed)
const ProfileName = styled(Typography)(({ theme }) => ({
  fontSize: "1.6rem", // Slightly reduced size
  fontWeight: 600,
  lineHeight: 1.2,
  color: "var(--color-text-primary)", // Ensure text color consistency
}));

const ClientIdText = styled(Typography)(({ theme }) => ({
  fontSize: "0.875rem",
  color: "var(--color-text-secondary)",
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
}));

const StyledAvatar = styled(Avatar)(({ theme }) => ({
  backgroundColor: "var(--color-primary)",
  width: "60px", // Slightly smaller
  height: "60px",
  fontSize: "1.5rem", // Adjusted font size
  boxShadow: "0 2px 6px rgba(37, 126, 104, 0.25)", // Refined shadow
}));

const TagsContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1.5), // Reduced margin
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1), // Consistent gap
  alignItems: "center",
}));

interface ProfileHeaderProps {
  firstName: string;
  lastName: string;
  isEditing: boolean; // Keep for potential future use if needed for edit states in header
  tags: string[];
  allTags: string[];
  handleTag: (tag: string) => void;
  clientId: string | null;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  firstName,
  lastName,
  isEditing, // Pass down if needed by Tags or other elements
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
    <ModernHeaderContainer>
      <Box sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <ProfileName variant="h1" sx={{ mb: 0, mr: 2 }}>
            {displayName()}
          </ProfileName>
          <TagsContainer sx={{ marginTop: 0 }}>
            <Tags
              allTags={allTags}
              values={tags}
              handleTag={handleTag}
              setInnerPopup={noOp}
              deleteMode={false}
              setTagToDelete={noOp}
              clientUid={clientId || ""}
            />
          </TagsContainer>
        </Box>
        <Stack spacing={0.5}>
          <ClientIdText variant="body2">
            <PersonIcon fontSize="inherit" />
            ID: {clientId || "Not assigned yet"}
          </ClientIdText>
        </Stack>
        <Divider sx={{ mb: 2, mt: 2 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <PersonIcon sx={{ color: '#257e68', mr: 1 }} />
          <Typography
            sx={{
              color: '#257e68',
              fontWeight: 700,
              fontSize: '1.35rem',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              borderBottom: '4px solid #257e68',
              display: 'inline-block',
              lineHeight: 1.1,
              pb: '2px',
              mr: 2
            }}
          >
            OVERVIEW
          </Typography>
        </Box>
      </Box>
    </ModernHeaderContainer>
  );
};

export default ProfileHeader;