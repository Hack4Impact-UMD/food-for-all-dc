import React from "react";
import { Box, Typography, Select, MenuItem, Tooltip, Autocomplete, TextField } from "@mui/material";
import InfoIcon from '@mui/icons-material/Info';
import { ClientProfile } from '../../../types';
import { ClientProfileKey, InputType } from '../types';
import { CaseWorker } from "../../../types";

export interface BasicInfoFormProps {
  clientProfile: ClientProfile;
  isEditing: boolean;
  errors: { [key: string]: string };
  renderField: (fieldPath: ClientProfileKey, type?: InputType, addressInputRef?: React.RefObject<HTMLInputElement | null>) => React.ReactNode;
  fieldLabelStyles: any;
  selectedCaseWorker: CaseWorker | null;
  caseWorkers: CaseWorker[];
  setShowCaseWorkerModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleCaseWorkerChange: (cw: CaseWorker | null) => void;
  addressError?: string;
  addressInputRef?: React.RefObject<HTMLInputElement | null>;
}

const BasicInfoForm: React.FC<BasicInfoFormProps> = ({
  clientProfile,
  isEditing,
  errors,
  renderField,
  fieldLabelStyles,
  selectedCaseWorker,
  caseWorkers,
  setShowCaseWorkerModal,
  handleCaseWorkerChange,
  addressError,
  addressInputRef,
}) => {
  return (
    <Box
      sx={{
        display: "grid",
        gap: isEditing ? 4 : 6,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, 1fr)",
          md: "repeat(3, 1fr)",
        },
        alignItems: "flex-start",
      }}
      className="info-grid"
    >
      {/* First Name */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          FIRST NAME <span className="required-asterisk">*</span>
        </Typography>
        {renderField("firstName", "text")}        <Box sx={{ minHeight: '24px' }}>  {/* Fixed height error container */}
        </Box>
      </Box>

      {/* Last Name */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          LAST NAME <span className="required-asterisk">*</span>
        </Typography>
        {renderField("lastName", "text")}       
      
      </Box>      {/* Date of Birth */}      <Box sx={{ minHeight: '130px' }}>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          DATE OF BIRTH <span className="required-asterisk">*</span>
        </Typography>
        {renderField("dob", "date")}
        <Box sx={{ minHeight: '24px' }}></Box>
      </Box>

      {/* Address 1 */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          ADDRESS <span className="required-asterisk">*</span>
        </Typography>
        {renderField("address", "text", addressInputRef)}        <Box sx={{ minHeight: '24px' }}>  {/* Fixed height error container */}
        </Box>
      </Box>

      {/* Address 2 */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          ADDRESS 2
        </Typography>
        {renderField("address2", "textarea")} 
      </Box>

      {/* City */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          CITY <span className="required-asterisk">*</span>
        </Typography>
        {renderField("city", "text")}
      </Box>

      {/* State */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          STATE <span className="required-asterisk">*</span>
        </Typography>
        {renderField("state", "text")}
        {/* Add state warning for non-DC states */}
        {clientProfile.state && clientProfile.state !== "DC" && !errors.state && (
            <Typography
              variant="body2"
              sx={{
              color: '#d32f2f',
              fontSize: '0.875rem',
              marginTop: '4px'
            }}
            >
              Warning: State is outside DC ({clientProfile.state})
            </Typography>
        )}
      </Box>

      {/* ZIP CODE */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          ZIP CODE <span className="required-asterisk">*</span>
        </Typography>
        {renderField("zipCode", "text")}
      </Box>

      {/* Quadrant */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          QUADRANT
        </Typography>
        {renderField("quadrant", "text")}
      </Box>

      {/* Ward */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          WARD
        </Typography>
        {isEditing ? (
          <Tooltip title="Ward will be automatically updated based on address when saved." placement="top">
            <span>
              {renderField("ward", "textarea")}
            </span>
          </Tooltip>
        ) : (
          renderField("ward", "textarea")
        )}
      </Box>

      {/* Email */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            EMAIL
          </Typography>
          <Tooltip 
            title={
              <React.Fragment>
                <Typography variant="subtitle2">Allowed formats:</Typography>
                <Typography variant="body2">name@example.com</Typography>
                <Typography variant="body2">name@domain.com</Typography>
                <Typography variant="body2">name@company.org</Typography>
              </React.Fragment>
            } 
            arrow
          >
            <InfoIcon 
              sx={{ 
                color: '#257E68', 
                fontSize: '20px',
                cursor: 'help',
                verticalAlign: 'middle',
                marginTop: '-12px'
              }} 
            />
          </Tooltip>
        </Box>
        {renderField("email", "email")}
        {errors.email && (
          <Typography color="error" variant="body2">
            {errors.email}
          </Typography>
        )}
      </Box>

      {/* Phone */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            PHONE <span className="required-asterisk">*</span>
          </Typography>
          <Tooltip 
            title={
              <React.Fragment>
                <Typography variant="subtitle2">Allowed formats:</Typography>
                <Typography variant="body2">(123) 456-7890</Typography>
                <Typography variant="body2">123-456-7890</Typography>
                <Typography variant="body2">123.456.7890</Typography>
                <Typography variant="body2">123 456 7890</Typography>
                <Typography variant="body2">1234567890</Typography>
                <Typography variant="body2">+1 123-456-7890</Typography>
              </React.Fragment>
            } 
            arrow
          >
            <InfoIcon 
              sx={{ 
                color: '#257E68', 
                fontSize: '20px',
                cursor: 'help',
                verticalAlign: 'middle', 
                marginTop: '-12px'
              }} 
            />
          </Tooltip>
        </Box>
        {renderField("phone", "text")}
        {errors.phone && (
          <Typography color="error" variant="body2" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
            {errors.phone}
          </Typography>
        )}
      </Box>

      {/* Alternative Phone */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography className="field-descriptor" sx={fieldLabelStyles}>
            ALTERNATIVE PHONE
          </Typography>
          <Tooltip 
            title={
              <React.Fragment>
                <Typography variant="subtitle2">Allowed formats:</Typography>
                <Typography variant="body2">(123) 456-7890</Typography>
                <Typography variant="body2">123-456-7890</Typography>
                <Typography variant="body2">123.456.7890</Typography>
                <Typography variant="body2">123 456 7890</Typography>
                <Typography variant="body2">1234567890</Typography>
                <Typography variant="body2">+1 123-456-7890</Typography>
              </React.Fragment>
            } 
            arrow
          >
            <InfoIcon 
              sx={{ 
                color: '#257E68', 
                fontSize: '20px',
                cursor: 'help',
                verticalAlign: 'middle',
                marginTop: '-12px'
              }} 
            />
          </Tooltip>
        </Box>
        {renderField("alternativePhone", "text")}
        {errors.alternativePhone && (
          <Typography color="error" variant="body2" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
            {errors.alternativePhone}
          </Typography>
        )}
      </Box>

      {/* Gender */}
      <Box>
        <Typography
          className="field-descriptor"
          sx={fieldLabelStyles}
        >
          GENDER <span className="required-asterisk">*</span>
        </Typography>
        {renderField("gender", "text")}
        {errors.gender && (
          <Typography color="error" variant="body2">
            {errors.gender}
          </Typography>
        )}
      </Box>

      {/* Ethnicity */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          ETHNICITY <span className="required-asterisk">*</span>
        </Typography>
        {renderField("ethnicity", "text")}
         <Box sx={{ minHeight: '24px' }}></Box>
      </Box>

      {/* Language */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          LANGUAGE <span className="required-asterisk">*</span>
        </Typography>
        {renderField("language", "text")}
        <Box sx={{ minHeight: '24px' }}></Box>
      </Box>

      {/* Adults */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          ADULTS (18-59) <span className="required-asterisk">*</span>
        </Typography>
        {renderField("adults", "number")}
        {errors.adults && (
          <Typography color="error" variant="body2">
            {errors.adults}
          </Typography>
        )}
      </Box>

      {/* Children */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          CHILDREN (0-17) <span className="required-asterisk">*</span>
        </Typography>
        {renderField("children", "number")}
        {errors.children && (
          <Typography color="error" variant="body2">
            {errors.children}
          </Typography>
        )}
      </Box>

      {/* Seniors */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          SENIORS (60+)
        </Typography>
        {renderField("seniors", "number")}
      </Box>

      {/* Total */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          TOTAL
        </Typography>
        {renderField("total", "text")}
      </Box>

      {/* Head of Household */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          HEAD OF HOUSEHOLD
        </Typography>
        {renderField("headOfHousehold", "select")}
      </Box>

      {/* Referral Entity */}
      <Box> 
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
        REFERRAL ENTITY
        </Typography>
        {isEditing ? (
          <>
            <Autocomplete
              value={selectedCaseWorker}
              onChange={(_, newValue) => {
                if (newValue && newValue.id === 'edit_list') {
                  setShowCaseWorkerModal(true);
                } else {
                  handleCaseWorkerChange(newValue);
                }
              }}
              // creating an object for the edit list option, rest of array is case workers
              options = {[{ id: 'edit_list', name: 'Edit Case Worker List', organization: '' } as CaseWorker, ...caseWorkers]}
              getOptionLabel = {(option) => 
                option.id === 'edit_list' 
                  ? 'Edit Case Worker List'
                  : `${option.name}, ${option.organization}`
              }
              sx = {{ 
                width: '100%',
                position: 'relative',
                // Ensure proper container bounds
                '& .MuiAutocomplete-clearIndicator': {
                  display: 'none',
                },
                // Position the dropdown arrow inside the field bounds
                '& .MuiAutocomplete-popupIndicator': {
                  position: 'absolute !important',
                  right: '12px !important',
                  top: '50% !important',
                  transform: 'translateY(-50%) !important',
                  color: '#666 !important',
                  fontSize: '1.2rem !important',
                  padding: '4px !important',
                  zIndex: 10,
                  width: '24px',
                  height: '24px',
                },
                // Ensure the input container has proper bounds and padding
                '& .MuiOutlinedInput-root': {
                  paddingRight: '48px !important', // Adequate space for the arrow
                  overflow: 'hidden',
                },
                // Make sure input text doesn't overlap arrow
                '& .MuiAutocomplete-input': {
                  paddingRight: '8px !important',
                },
              }}              renderInput = {(params) => (
                <TextField
                  {...params}
                  variant = "outlined"
                  sx={{
                    backgroundColor: "white",
                    '& .MuiOutlinedInput-root': {
                      height: "56px",
                      padding: "0.1rem 0.5rem",
                      '& fieldset': {
                        border: ".1rem solid black",
                        borderRadius: "5px",
                      },                      '&.Mui-focused fieldset': {
                        border: "2px solid #257E68",
                        boxShadow: "0 0 8px rgba(37, 126, 104, 0.4), 0 0 16px rgba(37, 126, 104, 0.2)",
                      },
                    },
                    '& .MuiAutocomplete-input': {
                      padding: '1 !important',
                      fontWeight: 500,
                    }
                  }}
                />
              )}
              // specifying the render option for the edit case worker option
              renderOption={(props, option) => (
                <li {...props} style={{ 
                  color: option.id === 'edit_list' ? "#257E68" : 'inherit',
                  fontWeight: option.id === 'edit_list' ? "bold" : 'normal'
                }}>
                  {option.id === 'edit_list' 
                    ? 'Edit Case Worker List'
                    : `${option.name}, ${option.organization}`
                  }
                </li>
              )}
              // Enable the dropdown arrow
              forcePopupIcon={true}
            />
          </>
        ) : (
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {selectedCaseWorker
              ? `${selectedCaseWorker.name}, ${selectedCaseWorker.organization}`
              : "None"}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default BasicInfoForm;