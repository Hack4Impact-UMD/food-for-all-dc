import React from "react";
import { Box, Typography, MenuItem } from "@mui/material";
import { CaseWorker, ClientProfile } from '../../../types';
import { ClientProfileKey, InputType } from '../types';
import { styled, Select } from "@mui/material";
import TagManager from "../Tags/TagManager";

interface DeliveryInfoFormProps {
  clientProfile: ClientProfile;
  isEditing: boolean;
  renderField: (fieldPath: ClientProfileKey, type?: InputType) => React.ReactNode;
  fieldLabelStyles: any;
  lastDeliveryDate: string | null;
  isSaved: boolean;
}

const fieldStyles = {
  backgroundColor: "white",
  width: "60%",
  height: "1.813rem",
  padding: "0.1rem 0.5rem",
  borderRadius: "5px",
  border: ".1rem solid black",
  marginTop: "0px",
};

const CustomSelect = styled(Select)({
  // Target the outlined border
  "& .MuiOutlinedInput-root": {
    height: "1.813rem",
    width: "100%",
    "& .MuiOutlinedInput-notchedOutline": {
      border: "none", // removes the border
    },
  },
  "& fieldset": {
    border: "none",
  },
  "& .MuiSelect-select": {
    ...fieldStyles,
  },
  "& .MuiSelect-icon": {
    display: "none",
  },
});

const DeliveryInfoForm: React.FC<DeliveryInfoFormProps> = ({
  clientProfile,
  isEditing,
  renderField,
  fieldLabelStyles,
  lastDeliveryDate,
  isSaved,
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
          alignItems: "center",
        }}
        className="info-grid"
      >
        {/* Start Date */}
        <Box>
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            START DATE <span className="required-asterisk">*</span>
          </Typography>
          {renderField("startDate", "date")}
        </Box>

        {/* End Date */}
        <Box>
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            END DATE <span className="required-asterisk">*</span>
          </Typography>
          {renderField("endDate", "date")}
        </Box>

        {/* Recurrence */}
        <Box>
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            RECURRENCE <span className="required-asterisk">*</span>
          </Typography>
          {isEditing ? (
            <CustomSelect
              name="recurrence"
              value={clientProfile.recurrence || ""}
              onChange={(e) => {
                const { value } = e.target;
                // Callback to handle change would be used here
              }}
              fullWidth
            >
              <MenuItem value="None">None</MenuItem>
              <MenuItem value="Weekly">Weekly</MenuItem>
              <MenuItem value="2x-Monthly">2x-Monthly</MenuItem>
              <MenuItem value="Monthly">Monthly</MenuItem>
            </CustomSelect>
          ) : (
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {clientProfile.recurrence || "N/A"}
            </Typography>
          )}
        </Box>

        {/* Delivery Instructions */}
        <Box>
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            DELIVERY INSTRUCTIONS
          </Typography>
          {renderField("deliveryDetails.deliveryInstructions", "textarea")}
        </Box>

        <Box>
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            LAST DELIVERY DATE
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {lastDeliveryDate || "Loading..."}
          </Typography>
        </Box>

        {/* Notes */}
        <Box>
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            ADMIN NOTES
          </Typography>
          {renderField("notes", "textarea")}
          {isSaved && clientProfile.notes.trim() !== "" && (
            <p id="timestamp">
              Last edited:{" "}
              {clientProfile.notesTimestamp &&
                clientProfile.notesTimestamp.timestamp &&
                new Date(
                  typeof clientProfile.notesTimestamp.timestamp === "object"
                    ? clientProfile.notesTimestamp.timestamp
                    : clientProfile.notesTimestamp.timestamp
                ).toLocaleString()}
            </p>
          )}
        </Box>
      </Box>
    </>
  );
};

export default DeliveryInfoForm;