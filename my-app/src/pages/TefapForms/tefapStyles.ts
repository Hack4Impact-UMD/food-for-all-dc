// Shared styling for the TEFAP screens.
//
// MUI's default palette is blue, but this app is green and applies that per
// component through CSS variables rather than a theme provider. Without these
// every contained button on these screens would render blue and read as if it
// belonged to a different product.

import type { SxProps, Theme } from "@mui/material";

/** Page shell, matching the other full-page admin tools. */
export const pageContainerSx: SxProps<Theme> = {
  padding: 3,
  paddingX: { xs: 2, md: 6 },
  paddingBottom: { xs: 5, md: 8 },
  maxWidth: 1400,
  marginX: "auto",
};

export const pageTitleSx: SxProps<Theme> = {
  color: "var(--color-primary)",
  fontWeight: 600,
};

export const pageSubtitleSx: SxProps<Theme> = {
  color: "var(--color-text-medium-alt)",
  marginTop: 0.5,
};

/** Filled green action. Labels are kept short so these stay compact. */
export const primaryButtonSx: SxProps<Theme> = {
  backgroundColor: "var(--color-primary)",
  color: "var(--color-white)",
  textTransform: "none",
  fontWeight: 600,
  whiteSpace: "nowrap",
  boxShadow: "var(--shadow-sm)",
  "&:hover": { backgroundColor: "var(--color-primary-hover)" },
};

/** Outlined green action, for secondary choices beside a primary one. */
export const secondaryButtonSx: SxProps<Theme> = {
  color: "var(--color-primary)",
  borderColor: "var(--color-primary)",
  textTransform: "none",
  fontWeight: 600,
  whiteSpace: "nowrap",
  "&:hover": {
    borderColor: "var(--color-primary-hover)",
    backgroundColor: "var(--color-background-green-tint)",
  },
};

/** Low-emphasis action inside dialogs and rows. */
export const quietButtonSx: SxProps<Theme> = {
  color: "var(--color-text-medium-alt)",
  textTransform: "none",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

export const cardSx: SxProps<Theme> = {
  borderRadius: "var(--border-radius-md)",
  borderColor: "var(--color-border-medium)",
  backgroundColor: "var(--color-background-card)",
};

/**
 * A selectable row in a list of forms.
 *
 * Deliberately a surface with its own text colours rather than a Button: a
 * Button tints everything inside it with the action colour, which leaves
 * secondary text sitting at low contrast on a coloured ground.
 */
export const selectableCardSx = (selected: boolean): SxProps<Theme> => ({
  ...cardSx,
  padding: 1.5,
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  display: "block",
  transition: "border-color 0.15s ease, background-color 0.15s ease",
  borderColor: selected ? "var(--color-primary)" : "var(--color-border-medium)",
  borderWidth: selected ? 2 : 1,
  backgroundColor: selected ? "var(--color-background-green-tint)" : "var(--color-background-card)",
  "&:hover": {
    borderColor: "var(--color-primary)",
    backgroundColor: "var(--color-background-green-tint)",
  },
});

export const fieldNameSx: SxProps<Theme> = {
  color: "var(--color-text-primary)",
  fontWeight: 600,
};

export const metaTextSx: SxProps<Theme> = {
  color: "var(--color-text-medium-alt)",
};

/**
 * Status pill. Uses tinted backgrounds with dark text rather than MUI's solid
 * "success" chip, whose white-on-green is heavier than anything else on the page.
 */
export const statusChipSx = (active: boolean): SxProps<Theme> => ({
  fontWeight: 600,
  textTransform: "capitalize",
  backgroundColor: active ? "var(--color-background-green-light)" : "var(--color-background-gray)",
  color: active ? "var(--color-primary-dark)" : "var(--color-text-medium-alt2)",
  border: "1px solid",
  borderColor: active ? "var(--color-primary-light)" : "var(--color-border-medium)",
});

/** Muted pill for supporting facts, readable on a white or tinted card. */
export const metaChipSx: SxProps<Theme> = {
  backgroundColor: "var(--color-background-light)",
  color: "var(--color-text-medium-alt2)",
  border: "1px solid var(--color-border-medium)",
  fontWeight: 500,
};
