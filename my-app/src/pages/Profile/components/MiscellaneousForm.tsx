import React from "react";
import { Box, Typography } from "@mui/material";
import { ClientProfileKey, InputType } from "../types";
import { ClientProfile } from "../../../types";
import TagManager from "../Tags/TagManager";

interface MiscellaneousFormProps {
  clientProfile: ClientProfile;
  isEditing: boolean;
  renderField: (fieldPath: ClientProfileKey, type?: InputType) => React.ReactNode;
  fieldLabelStyles: any;
  errors: { [key: string]: string };
}

const MiscellaneousForm: React.FC<MiscellaneousFormProps> = ({
  clientProfile,
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
          {clientProfile.lifeChallenges.trim() !== "" && (
            <p id="timestamp">
              Last edited:{" "}
              {clientProfile.lifeChallengesTimestamp &&
                clientProfile.lifeChallengesTimestamp.timestamp &&
                new Date(
                  typeof clientProfile.lifeChallengesTimestamp.timestamp === "object" &&
                  clientProfile.lifeChallengesTimestamp.timestamp !== null &&
                  "toDate" in clientProfile.lifeChallengesTimestamp.timestamp &&
                  typeof clientProfile.lifeChallengesTimestamp.timestamp.toDate === "function"
                    ? clientProfile.lifeChallengesTimestamp.timestamp.toDate()
                    : clientProfile.lifeChallengesTimestamp.timestamp
                ).toLocaleString()}
            </p>
          )}
        </Box>

        {/* Lifestyle Goals */}
        <Box>
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            LIFESTYLE GOALS
          </Typography>
          {renderField("lifestyleGoals", "textarea")}
          {clientProfile.lifestyleGoals.trim() !== "" && (
            <p id="timestamp">
              Last edited:{" "}
              {clientProfile.lifestyleGoalsTimestamp &&
                clientProfile.lifestyleGoalsTimestamp.timestamp &&
                new Date(
                  typeof clientProfile.lifestyleGoalsTimestamp.timestamp === "object" &&
                  clientProfile.lifestyleGoalsTimestamp.timestamp !== null &&
                  "toDate" in clientProfile.lifestyleGoalsTimestamp.timestamp &&
                  typeof clientProfile.lifestyleGoalsTimestamp.timestamp.toDate === "function"
                    ? clientProfile.lifestyleGoalsTimestamp.timestamp.toDate()
                    : clientProfile.lifestyleGoalsTimestamp.timestamp
                ).toLocaleString()}
            </p>
          )}
        </Box>
      </Box>
    </>
  );
};

export default MiscellaneousForm;
