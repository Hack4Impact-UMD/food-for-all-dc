import { useState } from "react";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CloseIcon from "@mui/icons-material/Close";
import DeselectIcon from "@mui/icons-material/Deselect";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, Collapse, IconButton, Paper, Tooltip, Typography } from "@mui/material";

export interface SelectedDeliverySummary {
  id: string;
  label: string;
  popupVisible: boolean;
  clusterColor?: string;
}

interface SelectedDeliveriesControlProps {
  deliveries: SelectedDeliverySummary[];
  onTogglePopup: (deliveryId: string) => void;
  onRemoveSelected: (deliveryId: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onClearSelected: () => void;
}

const SelectedDeliveriesControl = ({
  deliveries,
  onTogglePopup,
  onRemoveSelected,
  onShowAll,
  onHideAll,
  onClearSelected,
}: SelectedDeliveriesControlProps) => {
  const [expanded, setExpanded] = useState(true);

  if (deliveries.length === 0) return null;

  const allPopupsVisible = deliveries.every((delivery) => delivery.popupVisible);

  return (
    <Paper
      aria-label="Selected deliveries"
      variant="outlined"
      sx={{
        position: "absolute",
        top: 10,
        right: 200,
        zIndex: 1050,
        width: 210,
        maxWidth: "calc(100% - 280px)",
        height: expanded ? 380 : "auto",
        p: 1,
        borderRadius: 1,
        borderColor: "var(--color-border-light)",
        backgroundColor: "rgba(255, 255, 255, 0.96)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Tooltip title={expanded ? "Collapse selected deliveries" : "Expand selected deliveries"}>
          <IconButton
            size="small"
            aria-label={expanded ? "Collapse selected deliveries" : "Expand selected deliveries"}
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Tooltip>
        <Typography variant="body2" sx={{ fontWeight: 700, mr: "auto" }}>
          Selected: {deliveries.length}
        </Typography>
        <Tooltip title={allPopupsVisible ? "Hide all popups" : "Show all popups"}>
          <IconButton
            aria-label={allPopupsVisible ? "Hide all" : "Show all"}
            aria-pressed={allPopupsVisible}
            onClick={allPopupsVisible ? onHideAll : onShowAll}
            size="small"
          >
            {allPopupsVisible ? (
              <VisibilityOffIcon fontSize="small" />
            ) : (
              <VisibilityIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title="Clear selected deliveries">
          <IconButton
            aria-label="Clear selected"
            onClick={onClearSelected}
            size="small"
          >
            <DeselectIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Collapse in={expanded} unmountOnExit sx={{ minHeight: 0 }}>
        <Box
          sx={{
            mt: 0.75,
            maxHeight: 312,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
            pr: 0.5,
          }}
        >
          {deliveries.map((delivery) => (
            <Box
              key={delivery.id}
              data-testid={`selected-delivery-${delivery.id}`}
              sx={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                minHeight: 34,
                pl: 1.25,
                pr: 0.25,
                border: "1px solid var(--color-border-light)",
                borderLeft: delivery.clusterColor
                  ? `6px solid ${delivery.clusterColor}`
                  : "1px solid var(--color-border-light)",
                borderRadius: 1,
                backgroundColor: delivery.clusterColor
                  ? `${delivery.clusterColor}1f`
                  : "var(--color-background-gray)",
              }}
            >
              <Tooltip title={delivery.label} placement="left">
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  {delivery.label}
                </Typography>
              </Tooltip>
              <Tooltip title={delivery.popupVisible ? "Hide popup" : "Show popup"}>
                <IconButton
                  size="small"
                  aria-label={`${delivery.popupVisible ? "Hide" : "Show"} popup for ${delivery.label}`}
                  aria-pressed={delivery.popupVisible}
                  onClick={() => onTogglePopup(delivery.id)}
                  sx={{ p: 0.5, ml: 0.25, flex: "0 0 auto" }}
                >
                  {delivery.popupVisible ? (
                    <VisibilityIcon fontSize="small" />
                  ) : (
                    <VisibilityOffIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
              <Tooltip title="Remove from selection">
                <IconButton
                  size="small"
                  aria-label={`Remove ${delivery.label} from selection`}
                  onClick={() => onRemoveSelected(delivery.id)}
                  sx={{ p: 0.5, flex: "0 0 auto" }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default SelectedDeliveriesControl;