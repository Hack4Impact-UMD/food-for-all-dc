import { Box, Typography, Divider, styled, Tooltip } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import React from "react";
import TagManager from "../Tags/TagManager";
import type { ClientServiceStatus } from "../../../types/client-types";

// Simplified Header Container
const ModernHeaderContainer = styled(Box)(({ theme }) => ({
  backgroundColor: "var(--color-white)",
  borderRadius: "12px", // Slightly softer radius
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)", // Subtle shadow
  padding: theme.spacing(7, 4, 3, 4), // Reduced top padding (Top, Right, Bottom, Left)
  marginBottom: theme.spacing(3),
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(3), // Gap between avatar and info
  width: "100%", // Ensure it takes full width within its container
}));

// Styled components for enhanced header (Keep Avatar, adjust others if needed)
const ProfileName = styled(Typography)(({ theme }) => ({
  fontSize: "1.6rem", // Slightly reduced size
  fontWeight: 600,
  lineHeight: 1.2,
  color: "var(--color-text-primary)", // Ensure text color consistency
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
  clientStatus?: ClientServiceStatus;
  activeStatus?: boolean;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  firstName,
  lastName,
  isEditing: _isEditing,
  tags,
  allTags,
  handleTag,
  clientId,
  clientStatus,
  activeStatus,
}) => {
  // Format name for display
  const displayName = () => {
    return firstName?.trim() || lastName?.trim()
      ? `${firstName || ""} ${lastName || ""}`.trim()
      : "New Client";
  };

  const resolvedClientStatus: ClientServiceStatus | undefined =
    clientStatus ?? (activeStatus === false ? "inactive" : activeStatus === true ? "active" : undefined);

  const statusLabel = resolvedClientStatus
    ? `${resolvedClientStatus.charAt(0).toUpperCase()}${resolvedClientStatus.slice(1)} profile`
    : "Profile status unavailable";

  const statusIcon =
    resolvedClientStatus === "active" ? (
      <CheckCircleIcon
        sx={{ color: "#4caf50", mr: 1, fontSize: "1.5rem", verticalAlign: "middle" }}
      />
    ) : resolvedClientStatus === "lapsed" ? (
      <WarningAmberIcon
        sx={{ color: "#ed6c02", mr: 1, fontSize: "1.5rem", verticalAlign: "middle" }}
      />
    ) : (
      <CancelIcon
        sx={{ color: "#bdbdbd", mr: 1, fontSize: "1.5rem", verticalAlign: "middle" }}
      />
    );

  // No-op function that satisfies eslint
  const noOp = (_param: unknown) => {
    // Intentionally empty, used as a placeholder for required props
    return;
  };

  return (
    <ModernHeaderContainer sx={{ position: "relative", pb: 0 }}>
      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", height: "100%" }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
          {/* Icon before name */}
          <Tooltip title={statusLabel} placement="right">
            {statusIcon}
          </Tooltip>
          <ProfileName variant="h1" sx={{ mb: 0, mr: 2, display: "flex", alignItems: "center" }}>
            {displayName()}
          </ProfileName>
          <TagsContainer sx={{ marginTop: 0 }}>
            <TagManager
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
        <Divider sx={{ mb: 2, mt: 2 }} />
        <Box sx={{ flex: 1, display: "flex", alignItems: "flex-end", minHeight: 0, p: 0, m: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-end",
              borderBottom: "4px solid #488477",
              width: "fit-content",
              pb: 0,
              m: 0,
            }}
          >
            <PersonIcon sx={{ color: "#488477", mr: 1, mb: 0.2, fontSize: "1.35rem" }} />
            <Typography
              sx={{
                color: "#488477",
                fontWeight: 700,
                fontSize: "1.35rem",
                letterSpacing: 0.5,
                textTransform: "uppercase",
                display: "inline-block",
                lineHeight: 1.1,
                mb: 0,
                pb: 0,
                borderBottom: "none",
              }}
            >
              OVERVIEW
            </Typography>
          </Box>
        </Box>
      </Box>
    </ModernHeaderContainer>
  );
};

export default ProfileHeader;
