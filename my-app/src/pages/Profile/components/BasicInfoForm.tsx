import React from "react";
import { Box, Typography } from "@mui/material";
import { ClientProfile } from '../../../types';
import { ClientProfileKey, InputType } from '../types';
import { CaseWorker } from "../../../types";
import { MenuItem, Select, styled } from "@mui/material";

interface BasicInfoFormProps {
  clientProfile: ClientProfile;
  isEditing: boolean;
  errors: { [key: string]: string };
  renderField: (fieldPath: ClientProfileKey, type?: InputType) => React.ReactNode;
  fieldLabelStyles: any;
  selectedCaseWorker: CaseWorker | null;
  caseWorkers: CaseWorker[];
  setShowCaseWorkerModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleCaseWorkerChange: (cw: CaseWorker | null) => void;
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
  "& .MuiOutlinedInput-root": {
    height: "1.813rem",
    width: "100%",
    "& .MuiOutlinedInput-notchedOutline": {
      border: "none",
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
}) => {
  return (
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
      {/* First Name */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          FIRST NAME <span className="required-asterisk">*</span>
        </Typography>
        {renderField("firstName", "text")}
        {errors.firstName && (
          <Typography color="error" variant="body2">
            {errors.firstName}
          </Typography>
        )}
      </Box>

      {/* Last Name */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          LAST NAME <span className="required-asterisk">*</span>
        </Typography>
        {renderField("lastName", "text")}
        {errors.lastName && (
          <Typography color="error" variant="body2">
            {errors.lastName}
          </Typography>
        )}
      </Box>

      {/* Date of Birth */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          DATE OF BIRTH <span className="required-asterisk">*</span>
        </Typography>
        {renderField("dob", "date")}
        {errors.dob && (
          <Typography color="error" variant="body2">
            {errors.dob}
          </Typography>
        )}
      </Box>

      {/* Address 1 */}
      <Box>
        <Typography
          className="field-descriptor"
          sx={{
            ...fieldLabelStyles,
            position: "relative",
            top: isEditing ? "-19px" : "0",
          }}
        >
          ADDRESS <span className="required-asterisk">*</span>
        </Typography>
        {renderField("address", "text")}
        {errors.address && (
          <Typography color="error" variant="body2">
            {errors.address}
          </Typography>
        )}
      </Box>

      {/* Address 2 */}
      <Box>
        <Typography
          className="field-descriptor"
          sx={{
            ...fieldLabelStyles,
            position: "relative",
            top: isEditing ? "-19px" : "0",
          }}
        >
          ADDRESS 2
        </Typography>
        {renderField("address2", "textarea")}
      </Box>

      {/* City */}
      <Box>
        <Typography
          className="field-descriptor"
          sx={{
            ...fieldLabelStyles,
            position: "relative",
            top: isEditing ? "-19px" : "0",
          }}
        >
          CITY <span className="required-asterisk">*</span>
        </Typography>
        {renderField("city", "text")}
        {errors.city && (
          <Typography color="error" variant="body2">
            {errors.city}
          </Typography>
        )}
      </Box>

      {/* State */}
      <Box>
        <Typography
          className="field-descriptor"
          sx={{
            ...fieldLabelStyles,
            position: "relative",
            top: isEditing ? "-19px" : "0",
          }}
        >
          STATE <span className="required-asterisk">*</span>
        </Typography>
        {renderField("state", "text")}
        {errors.state && (
          <Typography color="error" variant="body2">
            {errors.state}
          </Typography>
        )}
      </Box>

      {/* ZIP CODE */}
      <Box>
        <Typography
          className="field-descriptor"
          sx={{
            ...fieldLabelStyles,
            position: "relative",
            top: isEditing ? "-19px" : "0",
          }}
        >
          ZIP CODE <span className="required-asterisk">*</span>
        </Typography>
        {renderField("zipCode", "text")}
        {errors.zipCode && (
          <Typography color="error" variant="body2">
            {errors.zipCode}
          </Typography>
        )}
      </Box>

      {/* Quadrant */}
      <Box>
        <Typography
          className="field-descriptor"
          sx={{
            ...fieldLabelStyles,
            position: "relative",
            top: isEditing ? "-19px" : "0",
          }}
        >
          QUADRANT
        </Typography>
        {renderField("quadrant", "text")}
        {errors.quadrant && (
          <Typography color="error" variant="body2">
            {errors.quadrant}
          </Typography>
        )}
      </Box>

      {/* Ward */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          WARD
        </Typography>
        {renderField("ward", "textarea")}
      </Box>

      {/* Email */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          EMAIL <span className="required-asterisk">*</span>
        </Typography>
        {renderField("email", "email")}
        {errors.email && (
          <Typography color="error" variant="body2">
            {errors.email}
          </Typography>
        )}
      </Box>

      {/* Phone */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          PHONE <span className="required-asterisk">*</span>
        </Typography>
        {renderField("phone", "text")}
        {errors.phone && (
          <Typography color="error" variant="body2">
            {errors.phone}
          </Typography>
        )}
      </Box>

      {/* Alternative Phone */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          ALTERNATIVE PHONE
        </Typography>
        {renderField("alternativePhone", "text")}
      </Box>

      {/* Gender */}
      <Box>
        <Typography
          className="field-descriptor"
          sx={{
            ...fieldLabelStyles,
            position: "relative",
            top: isEditing ? "-10px" : "0",
          }}
        >
          GENDER <span className="required-asterisk">*</span>
        </Typography>
        {renderField("gender", "select")}
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
        {errors.ethnicity && (
          <Typography color="error" variant="body2">
            {errors.ethnicity}
          </Typography>
        )}
      </Box>

      {/* Language */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          LANGUAGE <span className="required-asterisk">*</span>
        </Typography>
        {renderField("language", "text")}
        {errors.language && (
          <Typography color="error" variant="body2">
            {errors.language}
          </Typography>
        )}
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

      {/* Head of Household */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          HEAD OF HOUSEHOLD
        </Typography>
        {renderField("headOfHousehold", "select")}
        {errors.headOfHousehold && (
          <Typography color="error" variant="body2">
            {errors.headOfHousehold}
          </Typography>
        )}
      </Box>

      {/* Total */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          TOTAL
        </Typography>
        {renderField("total", "text")}
      </Box>

      {/* Referral Entity */}
      <Box>
        <Typography className="field-descriptor" sx={fieldLabelStyles}>
          REFERRAL ENTITY
        </Typography>
        {isEditing ? (
          <CustomSelect
            name="referralEntity"
            value={selectedCaseWorker ? selectedCaseWorker.id : ""}
            onChange={(e) => {
              const selectedId = e.target.value;
              if (selectedId === "edit_list") {
                setShowCaseWorkerModal(true);
              } else {
                const selected = caseWorkers.find((cw) => cw.id === selectedId);
                handleCaseWorkerChange(selected || null);
              }
            }}
            style={{ width: "83.5%" }}
          >
            <MenuItem value="edit_list" sx={{ color: "#257E68", fontWeight: "bold" }}>
              Edit Case Worker List {">"}
            </MenuItem>
            {caseWorkers.map((caseWorker) => (
              <MenuItem key={caseWorker.id} value={caseWorker.id}>
                {caseWorker.name}, {caseWorker.organization}
              </MenuItem>
            ))}
          </CustomSelect>
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