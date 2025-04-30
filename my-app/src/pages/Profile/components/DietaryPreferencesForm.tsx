import React from "react";
import { Box, Typography } from "@mui/material";
import { DietaryRestrictions } from '../../../types';
import { ClientProfileKey, InputType } from '../types';

interface DietaryPreferencesFormProps {
  isEditing: boolean;
  renderField: (fieldPath: ClientProfileKey, type?: InputType) => React.ReactNode;
  fieldLabelStyles: any;
  dietaryRestrictions: DietaryRestrictions;
}

const DietaryPreferencesForm: React.FC<DietaryPreferencesFormProps> = ({
  isEditing,
  renderField,
  fieldLabelStyles,
  dietaryRestrictions,
}) => {
  return (
    <Box>
      <Typography className="field-descriptor" sx={fieldLabelStyles}>
        DIETARY RESTRICTIONS
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
        {renderField("deliveryDetails.dietaryRestrictions", "dietaryRestrictions")}
      </Box>
    </Box>
  );
};

export default DietaryPreferencesForm;