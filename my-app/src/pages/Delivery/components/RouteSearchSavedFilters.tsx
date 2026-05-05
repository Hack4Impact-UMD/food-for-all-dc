import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import type { SavedSearchItem } from "../utils/savedSearches";

interface RouteSearchSavedFiltersProps {
  currentQuery: string;
  savedSearches: SavedSearchItem[];
  onSaveCurrentSearch: (searchName?: string) => void;
  onApplySavedSearch: (query: string) => void;
  onOverwriteSavedSearch: (name: string, newQuery: string) => void;
  onDeleteSavedSearch: (query: string) => void;
}

const RouteSearchSavedFilters: React.FC<RouteSearchSavedFiltersProps> = ({
  currentQuery,
  savedSearches,
  onSaveCurrentSearch,
  onApplySavedSearch,
  onOverwriteSavedSearch,
  onDeleteSavedSearch,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [searchNameDraft, setSearchNameDraft] = useState("");
  const [conflictMode, setConflictMode] = useState<"duplicate" | "mismatch" | null>(null);
  const [conflictItem, setConflictItem] = useState<SavedSearchItem | null>(null);
  const isOpen = Boolean(anchorEl);
  const canSaveCurrent = currentQuery.trim().length > 0;

  const nameTakenByItem = searchNameDraft.trim()
    ? savedSearches.find(
        (s) => s.name.trim().toLowerCase() === searchNameDraft.trim().toLowerCase()
      ) ?? null
    : null;

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleSaveCurrent = () => {
    if (!canSaveCurrent) {
      return;
    }
    setSearchNameDraft(currentQuery.trim().slice(0, 40));
    setIsSaveDialogOpen(true);
  };

  const handleCloseSaveDialog = () => {
    setIsSaveDialogOpen(false);
    setSearchNameDraft("");
  };

  const handleConfirmSave = () => {
    const trimmedName = searchNameDraft.trim();
    const existingWithSameName = savedSearches.find(
      (s) => s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingWithSameName) {
      const sameQuery =
        existingWithSameName.query.trim().toLowerCase() ===
        currentQuery.trim().toLowerCase();
      setConflictItem(existingWithSameName);
      setConflictMode(sameQuery ? "duplicate" : "mismatch");
      return;
    }

    onSaveCurrentSearch(trimmedName || undefined);
    handleCloseSaveDialog();
    handleCloseMenu();
  };

  const handleOverwrite = () => {
    if (conflictItem) {
      onOverwriteSavedSearch(conflictItem.name, currentQuery);
    }
    setConflictMode(null);
    setConflictItem(null);
    handleCloseSaveDialog();
    handleCloseMenu();
  };

  const handleConflictUseDifferentName = () => {
    setConflictMode(null);
    setConflictItem(null);
    // Save dialog remains open so user can choose a different name
  };

  const handleConflictClose = () => {
    setConflictMode(null);
    setConflictItem(null);
  };

  const handleApplySaved = (query: string) => {
    onApplySavedSearch(query);
    handleCloseMenu();
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: "0 0 auto" }}>
      <Tooltip title="Save current search">
        <span>
          <IconButton
            aria-label="Save current search"
            onClick={handleSaveCurrent}
            disabled={!canSaveCurrent}
            sx={{
              height: 42,
              width: 42,
              borderRadius: "6px",
              color: "var(--color-white)",
              backgroundColor: "var(--color-primary)",
              "&:hover": {
                backgroundColor: "var(--color-primary-darker)",
              },
              "&.Mui-disabled": {
                color: "rgba(255,255,255,0.65)",
                backgroundColor: "var(--color-text-medium)",
              },
            }}
          >
            <BookmarkBorderIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Button
        variant="contained"
        aria-haspopup="menu"
        aria-expanded={isOpen ? "true" : undefined}
        aria-controls={isOpen ? "saved-searches-menu" : undefined}
        onClick={handleOpenMenu}
        endIcon={<ArrowDropDownIcon />}
        sx={{
          height: 42,
          width: "auto",
          minWidth: 160,
          maxWidth: 190,
          px: 1.5,
          flex: "0 0 auto",
          borderRadius: "6px",
          textTransform: "none",
          whiteSpace: "nowrap",
          backgroundColor: "var(--color-primary)",
          "&:hover": {
            backgroundColor: "var(--color-primary-darker)",
          },
        }}
      >
        Saved Filters
      </Button>

      <Menu
        id="saved-searches-menu"
        anchorEl={anchorEl}
        open={isOpen}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              minWidth: 360,
              maxWidth: 480,
              borderRadius: "10px",
              boxShadow: "0 8px 20px rgba(0, 0, 0, 0.12)",
            },
          },
        }}
      >
        <Box sx={{ px: 2, pt: 1.25, pb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Recent searches (Max: 5)
          </Typography>
        </Box>

        <Divider sx={{ my: 0.5 }} />

        {savedSearches.length === 0 ? (
          <MenuItem disabled sx={{ whiteSpace: "normal", opacity: 1 }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              No saved searches yet
            </Typography>
          </MenuItem>
        ) : (
          savedSearches.slice(0, 5).map((item) => (
            <MenuItem
              key={item.name}
              onClick={() => handleApplySaved(item.query)}
              sx={{
                alignItems: "center",
                py: 0.75,
                pr: 0.5,
              }}
            >
              <Tooltip title={item.query} placement="left" arrow>
                <Typography
                  variant="body2"
                  sx={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: 500,
                    mr: 1,
                  }}
                >
                  {item.name}
                </Typography>
              </Tooltip>
              <Tooltip title="Delete" placement="right" arrow>
                <IconButton
                  aria-label={`Delete saved search "${item.name}"`}
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSavedSearch(item.query);
                  }}
                  sx={{
                    color: "error.main",
                    ml: "auto",
                    flexShrink: 0,
                    "&:hover": { backgroundColor: "rgba(211,47,47,0.08)" },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </MenuItem>
          ))
        )}
      </Menu>

      <Dialog
        open={isSaveDialogOpen}
        onClose={handleCloseSaveDialog}
        aria-labelledby="save-search-dialog-title"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="save-search-dialog-title">Save Search</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Search name"
            placeholder="e.g. Ward 7 Friday"
            value={searchNameDraft}
            onChange={(event) => setSearchNameDraft(event.target.value)}
            error={Boolean(nameTakenByItem)}
            helperText={
              nameTakenByItem
                ? `"${nameTakenByItem.name}" is already saved — saving will prompt to overwrite`
                : "Hover the saved name to preview the full query"
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleConfirmSave();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSaveDialog} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleConfirmSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Conflict dialog: same name already exists */}
      <Dialog
        open={conflictMode !== null}
        onClose={handleConflictClose}
        aria-labelledby="save-conflict-dialog-title"
        fullWidth
        maxWidth="xs"
      >
        {conflictMode === "duplicate" && (
          <>
            <DialogTitle id="save-conflict-dialog-title">Already Saved</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                <strong>&quot;{conflictItem?.name}&quot;</strong> is already saved with this exact search.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button
                variant="contained"
                onClick={() => {
                  handleConflictClose();
                  handleCloseSaveDialog();
                  handleCloseMenu();
                }}
              >
                OK
              </Button>
            </DialogActions>
          </>
        )}
        {conflictMode === "mismatch" && (
          <>
            <DialogTitle id="save-conflict-dialog-title">Name Already Exists</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                A saved filter named <strong>&quot;{conflictItem?.name}&quot;</strong> already exists
                with a different search. Would you like to overwrite it or use a different name?
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleConflictUseDifferentName} color="inherit">
                Use a Different Name
              </Button>
              <Button variant="contained" onClick={handleOverwrite}>
                Overwrite
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default RouteSearchSavedFilters;
