import React from "react";
import { Box, Typography } from "@mui/material";
import { ClientProfileKey, InputType } from "../types";

interface ConfigField {
  id: string;
  label: string;
  type: string;
}

interface MiscellaneousFormProps {
  clientProfile: any;
  isEditing: boolean;
  renderField: (
    fieldPath: ClientProfileKey,
    type?: InputType,
    addressInputRef?: React.RefObject<HTMLInputElement | null>
  ) => JSX.Element;
  configFields: ConfigField[];
  fieldValues: Record<string, string>;
  handleFieldChange: (key: string, value: string) => void;
}

const MiscellaneousForm: React.FC<MiscellaneousFormProps> = ({
  clientProfile,
  isEditing,
  renderField,
  configFields = [],
  fieldValues,
  handleFieldChange,
}) => {
  return (
    <Box sx={{ width: "100%" }}>
      {/* Unified grid for main and config fields */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: isEditing ? "2px 1.5px" : "2.5px 2px",
          minWidth: 900,
          alignItems: "start",
        }}
      >
        {/* Main fields */}
        <Box>
          <Typography
            className="field-descriptor"
            sx={{
              fontWeight: 500,
              fontSize: "1rem",
              color: "var(--color-text-medium-alt)",
              mb: 0,
              pb: 0,
            }}
          >
            TEFAP CERT
          </Typography>
          {isEditing ? (
            <Box sx={{ minHeight: 120, width: "100%" }}>{renderField("tefapCert", "date")}</Box>
          ) : (
            <Typography
              sx={{
                fontWeight: 400,
                fontSize: "1.15rem",
                lineHeight: 1,
                mt: 0,
                mb: 0,
                pt: 0,
                textAlign: "left",
                pl: 0,
              }}
            >
              {clientProfile.tefapCert ? String(clientProfile.tefapCert) : "N/A"}
            </Typography>
          )}
        </Box>
        <Box>
          <Typography
            className="field-descriptor"
            sx={{
              fontWeight: 500,
              fontSize: "1rem",
              color: "var(--color-text-medium-alt)",
              mb: 0,
              pb: 0,
            }}
          >
            FAMILY START DATE
          </Typography>
          {isEditing ? (
            <Box sx={{ minHeight: 120, width: "100%" }}>{renderField("famStartDate", "date")}</Box>
          ) : (
            <Typography
              sx={{
                fontWeight: 400,
                fontSize: "1.15rem",
                lineHeight: 1,
                mt: 0,
                mb: 0,
                pt: 0,
                textAlign: "left",
                pl: 0,
              }}
            >
              {clientProfile.famStartDate ? String(clientProfile.famStartDate) : "N/A"}
            </Typography>
          )}
        </Box>
        <Box>
          <Typography
            className="field-descriptor"
            sx={{
              fontWeight: 500,
              fontSize: "1rem",
              color: "var(--color-text-medium-alt)",
              mb: 0,
              pb: 0,
            }}
          >
            LIFE CHALLENGES
          </Typography>
          {isEditing ? (
            <>
              <Box sx={{ minHeight: 120, width: "100%" }}>
                {renderField("lifeChallenges", "textarea")}
              </Box>
              {clientProfile.lifeChallenges && clientProfile.lifeChallenges?.trim() !== "" && (
                <span id="timestamp">
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
                </span>
              )}
            </>
          ) : (
            <Typography
              sx={{
                fontWeight: 400,
                fontSize: "1.15rem",
                lineHeight: 1,
                mt: 0,
                mb: 0,
                pt: 0,
                textAlign: "left",
                pl: 0,
              }}
            >
              {clientProfile.lifeChallenges ? String(clientProfile.lifeChallenges) : "N/A"}
            </Typography>
          )}
        </Box>
        <Box>
          <Typography
            className="field-descriptor"
            sx={{
              fontWeight: 500,
              fontSize: "1rem",
              color: "var(--color-text-medium-alt)",
              mb: 0,
              pb: 0,
            }}
          >
            LIFESTYLE GOALS
          </Typography>
          {isEditing ? (
            <>
              <Box sx={{ minHeight: 120, width: "100%" }}>
                {renderField("lifestyleGoals", "textarea")}
              </Box>
              {clientProfile.lifestyleGoals && clientProfile.lifestyleGoals?.trim() !== "" && (
                <span id="timestamp">
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
                </span>
              )}
            </>
          ) : (
            <Typography
              sx={{
                fontWeight: 400,
                fontSize: "1.15rem",
                lineHeight: 1,
                mt: 0,
                mb: 0,
                pt: 0,
                textAlign: "left",
                pl: 0,
              }}
            >
              {clientProfile.lifestyleGoals ? String(clientProfile.lifestyleGoals) : "N/A"}
            </Typography>
          )}
        </Box>
        {/* Config fields */}
        {configFields.length > 0 &&
          configFields.map((field, idx) => (
            <Box key={field.id || idx} sx={{ mb: 1 }}>
              <Typography
                className="field-descriptor"
                sx={{
                  fontWeight: 500,
                  fontSize: "1rem",
                  color: "var(--color-text-medium-alt)",
                  mb: 0,
                  pb: 0,
                }}
              >
                {field.label || field.id || `Field ${idx + 1}`}
              </Typography>
              {isEditing ? (
                field.type === "textarea" ? (
                  <Box sx={{ minHeight: 120, width: "100%" }}>
                    {renderField(field.id as ClientProfileKey, "textarea")}
                  </Box>
                ) : (
                  <Box sx={{ minHeight: 120, width: "100%" }}>
                    {renderField(field.id as ClientProfileKey, "text")}
                  </Box>
                )
              ) : (
                <Typography
                  sx={{
                    fontWeight: 400,
                    fontSize: "1.15rem",
                    lineHeight: 1,
                    mt: 0,
                    mb: 0,
                    pt: 0,
                    textAlign: "left",
                    pl: 0,
                  }}
                >
                  {field.id && clientProfile[field.id as keyof typeof clientProfile]
                    ? String(clientProfile[field.id as keyof typeof clientProfile])
                    : "N/A"}
                </Typography>
              )}
            </Box>
          ))}
      </Box>
    </Box>
  );
};
export default MiscellaneousForm;
