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
    <>
      <Box className="box-header" display="flex" alignItems="center" justifyContent="space-between">
        <Typography
          className="basic-info-title"
          sx={{ fontWeight: 500, fontSize: { xs: "20px", sm: "24px" } }}
        >
          Dietary Preferences
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: isEditing ? 3 : 5,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
          },
          alignItems: "center",
        }}
        className="info-grid"
      >
        <Box sx={{ gridColumn: isEditing ? "-1/1" : "" }}>
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            DIETARY RESTRICTIONS
          </Typography>
          {renderField("deliveryDetails.dietaryRestrictions", "dietaryRestrictions")}
        </Box>
      </Box>
    </>
  );
};

export default DietaryPreferencesForm;