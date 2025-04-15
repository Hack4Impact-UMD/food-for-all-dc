import React from 'react';
import { Box, Typography, TextField } from "@mui/material";

interface ClusterGenerationModalProps {
  clusterNum: number;
  setClusterNum: React.Dispatch<React.SetStateAction<number>>;
  minDeliveries: number;
  setMinDeliveries: React.Dispatch<React.SetStateAction<number>>;
  maxDeliveries: number;
  setMaxDeliveries: React.Dispatch<React.SetStateAction<number>>;
  clusterError: string;
}

const ClusterGenerationModal: React.FC<ClusterGenerationModalProps> = ({
  clusterNum,
  setClusterNum,
  minDeliveries,
  setMinDeliveries,
  maxDeliveries,
  setMaxDeliveries,
  clusterError
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        padding: "8px 0",
      }}
    >
      {/* Cluster Number Input */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="body1">Enter desired number of clusters:</Typography>
        <TextField
          type="number"
          value={clusterNum}
          sx={{ width: "100px" }}
          onChange={(e) => setClusterNum(Number(e.target.value))}
          inputProps={{ min: 1 }}
          size="small"
          variant="outlined"
        />
      </Box>

      {/* Deliveries Range Input */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginTop: "20px",
        }}
      >
        <Typography variant="body2">
          <b>
            <u>Deliveries Per Cluster:</u>
          </b>
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="body2">Minimum:</Typography>
          <TextField
            type="number"
            value={minDeliveries}
            sx={{ width: "100px" }}
            onChange={(e) => setMinDeliveries(Number(e.target.value))}
            inputProps={{ min: 0 }}
            size="small"
            variant="outlined"
          />

          <Typography variant="body2">Maximum:</Typography>
          <TextField
            type="number"
            value={maxDeliveries}
            sx={{ width: "100px" }}
            onChange={(e) => setMaxDeliveries(Number(e.target.value))}
            inputProps={{ min: 0 }}
            size="small"
            variant="outlined"
          />
        </Box>
        {clusterError ? <Typography color="error">{clusterError}</Typography> : null}
      </Box>
    </Box>
  );
};

export default ClusterGenerationModal;