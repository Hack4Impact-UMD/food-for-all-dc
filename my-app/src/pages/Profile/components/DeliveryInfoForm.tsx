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
          alignItems: "flex-start",
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
          {renderField("recurrence", "select")}
        </Box>
        
        {/* Last Delivery Date */}
        <Box>
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            LAST DELIVERY DATE
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {lastDeliveryDate || "Loading..."}
          </Typography>
        </Box>

        {/* Delivery Instructions */}
        <Box sx={{ gridColumn: { xs: '1', sm: 'span 1' } }}>
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            DELIVERY INSTRUCTIONS
          </Typography>
          {renderField("deliveryDetails.deliveryInstructions", "textarea")}
          {clientProfile.deliveryDetails.deliveryInstructions.trim() !== "" && (
            <p id="timestamp">
              Last edited:{" "}
              {clientProfile.deliveryInstructionsTimestamp &&
                clientProfile.deliveryInstructionsTimestamp.timestamp &&
                new Date(
                  typeof clientProfile.deliveryInstructionsTimestamp.timestamp === 'object' &&
                  clientProfile.deliveryInstructionsTimestamp.timestamp !== null &&
                  'toDate' in clientProfile.deliveryInstructionsTimestamp.timestamp &&
                  typeof clientProfile.deliveryInstructionsTimestamp.timestamp.toDate === 'function'
                    ? clientProfile.deliveryInstructionsTimestamp.timestamp.toDate()
                    : clientProfile.deliveryInstructionsTimestamp.timestamp
                ).toLocaleString()}
            </p>
          )}
        </Box>

        {/* Notes */}
        <Box sx={{ gridColumn: { xs: '1', sm: 'span 1' } }}>
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            ADMIN NOTES
          </Typography>
          {renderField("notes", "textarea")}
          {clientProfile.notes.trim() !== "" && (
            <p id="timestamp">
              Last edited:{" "}
              {clientProfile.notesTimestamp &&
                clientProfile.notesTimestamp.timestamp &&
                new Date(
                  typeof clientProfile.notesTimestamp.timestamp === 'object' &&
                  clientProfile.notesTimestamp.timestamp !== null &&
                  'toDate' in clientProfile.notesTimestamp.timestamp &&
                  typeof clientProfile.notesTimestamp.timestamp.toDate === 'function'
                    ? clientProfile.notesTimestamp.timestamp.toDate()
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