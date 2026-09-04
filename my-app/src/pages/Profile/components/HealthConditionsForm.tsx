import React from "react";
import { Box, Typography } from "@mui/material";
import { DietaryRestrictions } from "../../../types";
import { ClientProfileKey, InputType } from "../types";

interface HealthConditionsFormProps {
  isEditing: boolean;
  renderField: (fieldPath: ClientProfileKey, type?: InputType) => React.ReactNode;
  fieldLabelStyles: any;
  dietaryRestrictions: DietaryRestrictions;
}

// Keeps each heading visually attached to its own checkboxes: a tight gap below
// the heading, and a larger gap above it to separate it from the previous group.
const optionsGridStyles = {
  display: "grid",
  gap: 2,
  gridTemplateColumns: {
    xs: "1fr",
    sm: "repeat(2, 1fr)",
    md: "repeat(3, 1fr)",
  },
  mt: 0.5,
};

const HealthConditionsForm: React.FC<HealthConditionsFormProps> = ({
  isEditing,
  renderField,
  fieldLabelStyles,
  dietaryRestrictions,
}) => {
  const subsequentLabelStyles = { ...fieldLabelStyles, mt: 3 };

  return (
    <Box>
      <Typography className="field-descriptor" sx={fieldLabelStyles}>
        Physical Ailments
      </Typography>
      <Box sx={optionsGridStyles}>
        {renderField("physicalAilments", "physicalAilments")}
      </Box>

      <Typography className="field-descriptor" sx={subsequentLabelStyles}>
        Physical Disabilities
      </Typography>
      <Box sx={optionsGridStyles}>
        {renderField("physicalDisability", "physicalDisability")}
      </Box>

      <Typography className="field-descriptor" sx={subsequentLabelStyles}>
        Mental Health Conditions
      </Typography>
      <Box sx={optionsGridStyles}>
        {renderField("mentalHealthConditions", "mentalHealthConditions")}
      </Box>
    </Box>
  );
};

export default HealthConditionsForm;
