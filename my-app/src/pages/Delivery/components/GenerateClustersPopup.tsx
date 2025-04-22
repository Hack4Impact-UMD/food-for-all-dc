import React, { useState } from "react";
import { TextField, Typography, DialogActions, Box } from "@mui/material";
import Button from '../../../components/common/Button'; // Corrected import path

interface GenerateClustersPopupProps {
  onGenerateClusters: (clusterNum: number, minDeliveries: number, maxDeliveries: number) => Promise<void>;
  onClose: () => void;
  // visibleRows: any[]; // Add if needed, but currently unused in this component itself
}

export default function GenerateClustersPopup({ onGenerateClusters, onClose }: GenerateClustersPopupProps) {
  const [maxDeliveries, setMaxDeliveries] = useState(5);
  const [minDeliveries, setMinDeliveries] = useState(1);
  const [clusterError, setClusterError] = useState<string>(""); // Explicitly type state
  const [clusterNum, setClusterNum] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false); // Add submitting state

  const handleGenerate = async () => {
    setIsSubmitting(true);
    setClusterError(""); // Clear previous errors
    try {
      await onGenerateClusters(clusterNum, minDeliveries, maxDeliveries);
      resetAndClose(); // Close only on success
    } catch (e: any) {
      setClusterError(e.message || "An unexpected error occurred."); // Set error message
    } finally {
      setIsSubmitting(false); // Re-enable button
    }
  };

  const resetAndClose = () => {
    setMaxDeliveries(5);
    setMinDeliveries(1);
    setClusterError("");
    setClusterNum(1);
    setIsSubmitting(false);
    if (onClose) onClose();
  };

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 1 /* Add padding inside DialogContent */ }}>
        {/* Cluster Number Input */}
        <TextField
          label="Number of Clusters"
          type="number"
          value={clusterNum}
          onChange={(e) => setClusterNum(Math.max(1, Number(e.target.value)))} // Ensure >= 1
          inputProps={{ min: 1 }}
          variant="outlined"
          fullWidth // Take full width for better alignment
          size="small"
          error={!!clusterError} // Show error state if general error exists
        />

        {/* Deliveries Range Input */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
           <Typography variant="body1" fontWeight="medium">
             Deliveries Per Cluster:
           </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', alignItems: 'center' }}>
            <TextField
              label="Minimum"
              type="number"
              value={minDeliveries}
              onChange={(e) => setMinDeliveries(Math.max(0, Number(e.target.value)))} // Ensure >= 0
              inputProps={{ min: 0 }}
              variant="outlined"
              size="small"
              error={!!clusterError} // Show error state
              sx={{ flexGrow: 1 }} // Allow fields to grow
            />
            <TextField
              label="Maximum"
              type="number"
              value={maxDeliveries}
              onChange={(e) => setMaxDeliveries(Math.max(0, Number(e.target.value)))} // Ensure >= 0
              inputProps={{ min: 0 }}
              variant="outlined"
              size="small"
              error={!!clusterError} // Show error state
              sx={{ flexGrow: 1 }} // Allow fields to grow
            />
          </Box>
        </Box>

        {/* Error Message Display */}
        {clusterError && (
          <Typography color="error" variant="body2" sx={{ mt: -1 /* Adjust spacing */ }}>
            {clusterError}
          </Typography>
        )}
      </Box>

      <DialogActions sx={{ pt: 2, pb: 1, pr: 1 }}>
        <Button
          variant="secondary" // Use secondary variant for Cancel
          onClick={resetAndClose}
          disabled={isSubmitting}
          size="medium"
        >
          Cancel
        </Button>
        <Button
          variant="primary" // Use primary variant for Generate
          onClick={handleGenerate}
          disabled={isSubmitting || clusterNum <= 0 || minDeliveries < 0 || maxDeliveries <= 0 || minDeliveries > maxDeliveries} // Basic client-side validation
          size="medium"
        >
          {isSubmitting ? "Generating..." : "Generate"} {/* Show loading text */}
        </Button>
      </DialogActions>
    </>
  );
}

