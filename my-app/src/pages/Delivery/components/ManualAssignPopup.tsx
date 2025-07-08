import { useState } from "react";
import { TextField, Typography, DialogActions, Box } from "@mui/material";
import Button from '../../../components/common/Button';
import { RowData } from "../types/deliveryTypes";
import ClientCard from "./ClientCard";

interface GenerateClustersPopupProps {
  manualAssign: (newClusters: string[], clusters: number) => Promise<void>;
  onClose: () => void;
  allDeliveries: RowData[]
}

export default function ManualAssign({ manualAssign, onClose, allDeliveries }: GenerateClustersPopupProps) {
  const [values, setValues] = useState({
    clusterNum: "1",
    assignedCluster: "1"
  });
  const [errors, setErrors] = useState({
    clusterNum: "",
    assignedCluster: "",
    form: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [clusterState, setClusterState] = useState<string[]>(
    Array(allDeliveries.length).fill('0')
  );

  const validateFields = () => {
    const newErrors = {
      clusterNum: "",
      assignedCluster: "",
      form: ""
    };

    //validate clusterNum
    if (values.clusterNum === "") {
      newErrors.clusterNum = "Required";
    } else if (isNaN(Number(values.clusterNum))) {
      newErrors.clusterNum = "Must be a number";
    } else if (Number(values.clusterNum) <= 0) {
      newErrors.clusterNum = "Must be positive";
    }

    //validate assignedCluster
    if (values.assignedCluster === "") {
      newErrors.assignedCluster = "Required";
    } else if (isNaN(Number(values.assignedCluster))) {
      newErrors.assignedCluster = "Must be a number";
    } else {
      const clusterNumValue = Number(values.clusterNum);
      const assignedValue = Number(values.assignedCluster);
      
      if (assignedValue <= 0) {
        newErrors.assignedCluster = "Must be positive";
      } else if (assignedValue > clusterNumValue) {
        newErrors.assignedCluster = `Must be ≤ ${clusterNumValue}`;
      }
    }

    setErrors(newErrors);
    return !newErrors.clusterNum && !newErrors.assignedCluster;
  };

  const handleInputChange = (name: keyof typeof values, value: string) => {
    //only allow numbers or empty string
    if (value !== "" && !/^\d*$/.test(value)) return;

    const newValues = { ...values, [name]: value };
    setValues(newValues);

    //validate immediately with new values
    const newErrors = { ...errors };
    if (name === "clusterNum") {
      newErrors.clusterNum = "";
      if (value === "") {
        newErrors.clusterNum = "Required";
      } else if (isNaN(Number(value))) {
        newErrors.clusterNum = "Must be a number";
      } else if (Number(value) <= 0) {
        newErrors.clusterNum = "Must be positive";
      }

      //also validate assignedCluster against new clusterNum
      if (values.assignedCluster !== "") {
        const assignedValue = Number(values.assignedCluster);
        const newClusterNum = Number(value);
        if (assignedValue > newClusterNum) {
          newErrors.assignedCluster = `Must be ≤ ${newClusterNum}`;
        } else {
          newErrors.assignedCluster = "";
        }
      }
    } else if (name === "assignedCluster") {
      newErrors.assignedCluster = "";
      if (value === "") {
        newErrors.assignedCluster = "Required";
      } else if (isNaN(Number(value))) {
        newErrors.assignedCluster = "Must be a number";
      } else {
        const assignedValue = Number(value);
        const clusterNumValue = Number(values.clusterNum);
        
        if (assignedValue <= 0) {
          newErrors.assignedCluster = "Must be positive";
        } else if (assignedValue > clusterNumValue) {
          newErrors.assignedCluster = `Must be ≤ ${clusterNumValue}`;
        }
      }
    }

    setErrors(newErrors);
  };

  const handleManualAssign = async () => {
    if (!validateFields()) return;

    if (allDeliveries.length < 1) {
      setErrors(prev => ({ ...prev, form: "Must have at least one delivery" }));
      return;
    }

    if (selectedClients.length > 0) {
      setErrors(prev => ({ ...prev, form: "Please assign changes before saving" }));
      return;
    }

    let valid = true;
    clusterState.forEach((c) => {
      if (c === undefined) {
        valid = false;
      } else {
        const cluster = parseInt(c);
        if (cluster > Number(values.clusterNum)) {
          valid = false;
        }
      }
    });

    if (!valid) {
      setErrors(prev => ({ ...prev, form: "Invalid cluster assignments" }));
      return;
    }

    setIsSubmitting(true);
    try {
      await manualAssign(clusterState, Number(values.clusterNum));
      onClose();
    } catch (e: any) {
      setErrors(prev => ({ ...prev, form: e.message || "Failed to save assignments" }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const addToCluster = () => {
    if (errors.assignedCluster || !values.assignedCluster) return;

    const newClusterState = [...clusterState];
    selectedClients.forEach(index => {
      newClusterState[index] = values.assignedCluster;
    });
    
    setClusterState(newClusterState);
    setSelectedClients([]);
    setErrors(prev => ({ ...prev, form: "" }));
  };

  const resetAndClose = () => {
    setValues({
      clusterNum: "1",
      assignedCluster: "1"
    });
    setErrors({
      clusterNum: "",
      assignedCluster: "",
      form: ""
    });
    setClusterState(Array(allDeliveries.length).fill('0'));
    onClose();
  };

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 1 }}>
        {/* Cluster Number Input */}
        <TextField
          label="Number of Clusters"
          value={values.clusterNum}
          onChange={(e) => handleInputChange("clusterNum", e.target.value)}
          variant="outlined"
          fullWidth
          size="small"
          error={!!errors.clusterNum}
          helperText={errors.clusterNum}
          placeholder="Enter number"
        />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body1" fontWeight="medium" sx={{ textDecoration: 'underline' }}>
            Assign Clusters:
          </Typography>
          <Box sx={{ display: "flex", gap: "20px" }}>
            <TextField
              label="Select Cluster"
              value={values.assignedCluster}
              onChange={(e) => handleInputChange("assignedCluster", e.target.value)}
              variant="outlined"
              size="small"
              sx={{ width: "150px" }}
              error={!!errors.assignedCluster}
              helperText={errors.assignedCluster}
              placeholder="Enter number"
            />
            <Button 
              sx={{ flex: "1" }} 
              onClick={addToCluster} 
              disabled={selectedClients.length === 0 || !!errors.assignedCluster}
            >
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
              clusterState[index] === '0' ?
                <ClientCard 
                  key={client.id} 
                  client={client} 
                  index={index} 
                  selectedClients={selectedClients} 
                  setSelectedClients={setSelectedClients}
                />
                : null
            ))}
          </Box>
        </Box>

        {/* Error Message Display */}
        {errors.form && (
          <Typography color="error" variant="body2" sx={{ mt: -1 }}>
            {errors.form}
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
          disabled={isSubmitting || !!errors.clusterNum || !!errors.assignedCluster}
          size="medium"
        >
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </>
  );
}