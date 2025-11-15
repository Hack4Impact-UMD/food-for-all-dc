import React, { useState, useEffect } from "react";
import { TextField, Typography, DialogActions, Box, styled } from "@mui/material";
import Button from "../../../components/common/Button";

//added component to center label
const CenteredTextField = styled(TextField)({
  "& .MuiInputLabel-root": {
    top: "15%",
  },
});

interface GenerateClustersPopupProps {
  onGenerateClusters: (
    clusterNum: number,
    minDeliveries: number,
    maxDeliveries: number
  ) => Promise<void>;
  onClose: () => void;
}

export default function GenerateClustersPopup({
  onGenerateClusters,
  onClose,
}: GenerateClustersPopupProps) {
  const [values, setValues] = useState({
    clusterNum: "",
    minDeliveries: "",
    maxDeliveries: "",
  });
  const [errors, setErrors] = useState({
    clusterNum: "",
    minDeliveries: "",
    maxDeliveries: "",
    form: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  //validate fields using current values
  const validateFields = (currentValues: typeof values) => {
    const newErrors = {
      clusterNum: "",
      minDeliveries: "",
      maxDeliveries: "",
      form: "",
    };

    //validate clusterNum
    if (currentValues.clusterNum === "") {
      newErrors.clusterNum = "This field is required";
    } else if (isNaN(Number(currentValues.clusterNum))) {
      newErrors.clusterNum = "Must be a number";
    } else if (Number(currentValues.clusterNum) <= 0) {
      newErrors.clusterNum = "Must be positive";
    }

    //validate minDeliveries
    if (currentValues.minDeliveries === "") {
      newErrors.minDeliveries = "This field is required";
    } else if (isNaN(Number(currentValues.minDeliveries))) {
      newErrors.minDeliveries = "Must be a number";
    } else if (Number(currentValues.minDeliveries) <= 0) {
      newErrors.minDeliveries = "Must be positive";
    }

    //validate maxDeliveries
    if (currentValues.maxDeliveries === "") {
      newErrors.maxDeliveries = "This field is required";
    } else if (isNaN(Number(currentValues.maxDeliveries))) {
      newErrors.maxDeliveries = "Must be a number";
    } else if (Number(currentValues.maxDeliveries) <= 0) {
      newErrors.maxDeliveries = "Must be positive";
    }

    //cross validate min and max but only if both have values
    if (currentValues.minDeliveries && currentValues.maxDeliveries) {
      const minNum = Number(currentValues.minDeliveries);
      const maxNum = Number(currentValues.maxDeliveries);

      if (minNum > maxNum) {
        newErrors.minDeliveries = "Cannot be greater than maximum";
        newErrors.maxDeliveries = "Cannot be less than minimum";
      }
    }

    return newErrors;
  };

  const handleInputChange = (name: keyof typeof values, value: string) => {
    //only allow numbers or empty string
    if (value !== "" && !/^\d*$/.test(value)) return;

    //update values optimistically
    const newValues = { ...values, [name]: value };
    setValues(newValues);

    //validate with the new values immediately
    const newErrors = validateFields(newValues);
    setErrors(newErrors);
  };

  const handleGenerate = async () => {
    //final validation check
    const newErrors = validateFields(values);
    setErrors(newErrors);

    if (newErrors.clusterNum || newErrors.minDeliveries || newErrors.maxDeliveries) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onGenerateClusters(
        Number(values.clusterNum),
        Number(values.minDeliveries),
        Number(values.maxDeliveries)
      );
      onClose();
    } catch (e: any) {
      setErrors((prev) => ({ ...prev, form: e.message || "Failed to generate clusters" }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setValues({
      clusterNum: "",
      minDeliveries: "",
      maxDeliveries: "",
    });
    setErrors({
      clusterNum: "",
      minDeliveries: "",
      maxDeliveries: "",
      form: "",
    });
    onClose();
  };

  const isFormValid = () => {
    return (
      values.clusterNum !== "" &&
      values.minDeliveries !== "" &&
      values.maxDeliveries !== "" &&
      !errors.clusterNum &&
      !errors.minDeliveries &&
      !errors.maxDeliveries
    );
  };

  return (
    <>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3, p: 1 }}>
        {/* Cluster Number Input */}
        <Box>
          <CenteredTextField
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
        </Box>

        {/* Deliveries Range Input */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="body1" fontWeight="medium">
            Deliveries Per Cluster:
          </Typography>
          <Box sx={{ display: "flex", gap: 2 }}>
            <CenteredTextField
              label="Minimum"
              value={values.minDeliveries}
              onChange={(e) => handleInputChange("minDeliveries", e.target.value)}
              variant="outlined"
              size="small"
              error={!!errors.minDeliveries}
              helperText={errors.minDeliveries}
              placeholder="Enter number"
              fullWidth
            />
            <CenteredTextField
              label="Maximum"
              value={values.maxDeliveries}
              onChange={(e) => handleInputChange("maxDeliveries", e.target.value)}
              variant="outlined"
              size="small"
              error={!!errors.maxDeliveries}
              helperText={errors.maxDeliveries}
              placeholder="Enter number"
              fullWidth
            />
          </Box>
        </Box>

        {/* Form-level error */}
        {errors.form && (
          <Typography color="error" variant="body2">
            {errors.form}
          </Typography>
        )}
      </Box>

      <DialogActions sx={{ pt: 2, pb: 1, pr: 1 }}>
        <Button variant="secondary" onClick={resetAndClose} disabled={isSubmitting} size="medium">
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={!isFormValid() || isSubmitting}
          size="medium"
        >
          {isSubmitting ? "Generating..." : "Generate"}
        </Button>
      </DialogActions>
    </>
  );
}
