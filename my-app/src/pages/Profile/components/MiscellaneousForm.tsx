import React from "react";
import { Box, Typography } from "@mui/material";
import { ClientProfileKey, InputType } from "../types";
import TagManager from "../Tags/TagManager";

interface MiscellaneousFormProps {
  isEditing: boolean;
  renderField: (fieldPath: ClientProfileKey, type?: InputType) => React.ReactNode;
  fieldLabelStyles: any;
  errors: { [key: string]: string };
}

const MiscellaneousForm: React.FC<MiscellaneousFormProps> = ({
  isEditing,
  renderField,
  fieldLabelStyles,
  errors,
}) => {
  return (
    <>
      <Box
        sx={{
          display: "grid",
          gap: isEditing ? 3 : 5,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
          },
          alignItems: "flex-start",
        }}
        className="info-grid"
      >
        <Box>
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            TEFAP CERTIFICATION
          </Typography>
          {renderField("tefapCert", "date")}
          {errors.tefapCert && (
            <Typography color="error" variant="body2">
              {errors.tefapCert}
            </Typography>
          )}
        </Box>

        {/* Life Challenges */}
        <Box>
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            LIFE CHALLENGES
          </Typography>
          {renderField("lifeChallenges", "textarea")}
        </Box>

        {/* Lifestyle Goals */}
        <Box>
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            LIFESTYLE GOALS
          </Typography>
          {renderField("lifestyleGoals", "textarea")}
        </Box>
      </Box>
    </>
  );
};

export default MiscellaneousForm;