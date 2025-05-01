import { useState } from "react";
import { TextField, Typography, DialogActions, Box } from "@mui/material";
import Button from '../../../components/common/Button'; // Corrected import path
import { RowData } from "../types/deliveryTypes";
import ClientCard from "./ClientCard";

interface GenerateClustersPopupProps {
  manualAssign: (newClusters: string[], clusters: number) => Promise<void>;
  onClose: () => void;
  allDeliveries: RowData[]
}

export default function ManualAssign({ manualAssign, onClose, allDeliveries}: GenerateClustersPopupProps) {
  const [clusterError, setClusterError] = useState<string>(""); 
  const [clusterNum, setClusterNum] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [assignedCluster, setAssignedCluster] = useState<string>("1");
  const [clusterState, setClusterState] = useState<string[]>(
    Array(allDeliveries.length).fill('0') // Initialize all to 0
  );

  const handleManualAssign = async () => {
    //error checking
    if(clusterNum < 1){
      setClusterError("Must have at least one Cluster")
      return
    }else if(allDeliveries.length < 1) {
      setClusterError("Must have at least one delivery")
      return
    } else if(selectedClients.length > 0) {
      setClusterError("Please assign changes before saving")
      return
    }

    let valid = true;
    clusterState.forEach((c)=>{
      if(c === undefined){
        valid = false
      }
      else{
        const cluster = parseInt(c)
        if(cluster > clusterNum){
          valid = false
        }
      }
    })

    if(valid){
      setClusterError("")
      setIsSubmitting(true);
      manualAssign(clusterState, clusterNum)
    }
    else{
      setClusterError("Invalid Clusters") 
    }
  };

  const addToCluster = () => {
    const newClusterState = [...clusterState];
    selectedClients.forEach(index => {
      newClusterState[index] = assignedCluster;
    });
    
    setClusterState(newClusterState);
    setSelectedClients([]); 
    setClusterError("");
  };

  const resetAndClose = () => {
    setClusterError("");
    setClusterNum(1);
    setIsSubmitting(false);
    if (onClose) onClose();
  };

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 1}}>
        {/* Cluster Number Input */}
        <TextField
          label="Number of Clusters"
          type="number"
          value={clusterNum}
          onChange={(e) => setClusterNum(Math.max(1, Number(e.target.value)))} // Ensure >= 1
          inputProps={{ min: 1 }}
          variant="outlined"
          fullWidth 
          size="small"
          error={!!clusterError}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2}}>
           <Typography variant="body1" fontWeight="medium" sx={{textDecoration: 'underline'}}>
             Assign Clusters:
           </Typography>
           <Box sx={{display: "flex", gap:"20px"}}>
            <TextField
                label="Select Cluster"
                type="number"
                value={assignedCluster}
                onChange={(e) => {
                  const newValue = e.target.value;
                  const parsed = parseInt(newValue, 10);
                  if (!isNaN(parsed) && parsed <= clusterNum) {
                    setAssignedCluster(newValue);
                  }
                }}
                inputProps={{ min: 1, max: clusterNum}}
                variant="outlined"
                size="small"
                sx={{ width: "150px" }}
                error = {!!clusterError}
              />
              <Button sx={{flex:"1"}} onClick={addToCluster} disabled = {selectedClients.length == 0}>
                Assign Cluster
              </Button>
           </Box>
          <Box sx={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            maxHeight: "300px",
            overflowY: "auto",
            p: 1,
            border: "1px solid #ddd",
            borderRadius: "8px",
            backgroundColor: "#fafafa",
          }}>
            {allDeliveries.map((client: RowData, index) => (
              //filter for already assigned cluster
              clusterState[index] == '0' ?
              <ClientCard key={client.id} client={client} index={index} selectedClients={selectedClients} setSelectedClients={setSelectedClients}/>
              : ""
            ))}
          </Box>
        </Box>

        {/* Error Message Display */}
        {clusterError && (
          <Typography color="error" variant="body2" sx={{ mt: -1}}>
            {clusterError}
          </Typography>
        )}
      </Box>

      <DialogActions sx={{ pt: 2, pb: 1, pr: 1 }}>
        <Button
          variant="secondary"
          onClick={resetAndClose}
          disabled={isSubmitting}
          size="medium"
        >
          Cancel
        </Button>
        <Button
          variant="primary" 
          onClick={handleManualAssign}
          disabled={isSubmitting || clusterNum <= 0} // Basic client-side validation
          size="medium"
        >
          {isSubmitting ? "Saving..." : "Save"} 
        </Button>
      </DialogActions>
    </>
  );
}

