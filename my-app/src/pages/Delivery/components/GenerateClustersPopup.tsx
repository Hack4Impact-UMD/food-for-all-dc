import { Button, DialogActions, TextField, Typography } from "@mui/material";
import React, { useState, useEffect } from "react";

export default function GenerateClustersPopup({onGenerateClusters, onClose}: any){
      const [maxDeliveries, setMaxDeliveries] = useState(5);
      const [minDeliveries, setMinDeliveries] = useState(1);
      const [clusterError, setClusterError] = useState("");
      const [clusterNum, setClusterNum] = useState(1);

      const resetSelections = () => {
        setMaxDeliveries(5);
        setMinDeliveries(1);
        setClusterError("");
        setClusterNum(1);
        if (onClose) onClose();
      }

    return(
      <>
        <div style={{ 
            display: "flex", 
            flexDirection: "column", 
            gap: "20px",
            padding: "8px 0"
          }}>
            {/* Cluster Number Input */}
            <div style={{
              display: "flex", 
              alignItems: "center", 
              gap: "10px",
              justifyContent: "space-between"
            }}>
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
            </div>

            {/* Deliveries Range Input */}
            <div style={{
              display: "flex", 
              flexDirection: "column",
              gap: "10px",
              marginTop: "20px"
            }}>
              <Typography variant="body2"><b><u>Deliveries Per Cluster:</u></b></Typography>
              <div style={{
                display: "flex", 
                alignItems: "center", 
                gap: "10px",
                justifyContent: "space-between"
              }}>
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
              </div>
              {clusterError ? <p style={{color:"red"}}>{clusterError}</p> : null}
            </div>
          </div>
          <DialogActions>
            <Button onClick={() => {
                onGenerateClusters(clusterNum, minDeliveries, maxDeliveries)
                  .then(() => resetSelections())
                  .catch((e: any) => setClusterError(e.message));
            }}>SAVE</Button>
            <Button onClick={resetSelections}>CANCEL</Button>
          </DialogActions>
      </>
    )
}

