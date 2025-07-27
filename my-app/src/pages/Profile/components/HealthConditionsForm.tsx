import React from "react";
import { Box, Typography } from "@mui/material";
import { DietaryRestrictions } from '../../../types';
import { ClientProfileKey, InputType } from '../types';

interface HealthConditionsFormProps {
  isEditing: boolean;
  renderField: (fieldPath: ClientProfileKey, type?: InputType) => React.ReactNode;
  fieldLabelStyles: any;
  dietaryRestrictions: DietaryRestrictions;
}

const HealthConditionsForm: React.FC<HealthConditionsFormProps> = ({
  isEditing,
  renderField,
  fieldLabelStyles,
  dietaryRestrictions,
}) => {
  return (
    <Box>
      <Typography className="field-descriptor" sx={fieldLabelStyles}>
        Physical Ailments
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
          },
          mt: 2,
        }}
      >
        {renderField("physicalAilments", "physicalAilments")}
      </Box>
      <Typography className="field-descriptor" sx={fieldLabelStyles}>
        Physical Disabilities
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
          },
          mt: 2,
        }}
      >
        {renderField("physicalDisability", "physicalDisability")}
      </Box>

      <Typography className="field-descriptor" sx={fieldLabelStyles}>
        Mental Health Conditions
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
          },
          mt: 2,
        }}
      >
        {renderField("mentalHealthConditions", "mentalHealthConditions")}
      </Box>
    </Box>
  );
};

export default HealthConditionsForm;