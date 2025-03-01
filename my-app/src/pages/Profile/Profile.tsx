import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import PersonIcon from "@mui/icons-material/Person";
import SaveIcon from "@mui/icons-material/Save";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  Grid2,
  IconButton,
  makeStyles,
  MenuItem,
  Select,
  SelectChangeEvent,
  styled,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../auth/firebaseConfig";
import "./Profile.css";

import { Timestamp } from "firebase/firestore";
import Autocomplete from "react-google-autocomplete";

const fieldStyles = {
  backgroundColor: "#eee",
  width: "100%",
  height: "23px",
  padding: "0.1rem 0.5rem",
  borderRadius: "5px",
  marginTop: "0px",
};

const CustomTextField = styled(TextField)({
  "& .MuiOutlinedInput-root": {
    "& fieldset": {
      border: "none", // removes the border
    },
  },
  "& .MuiInputBase-input": fieldStyles,
});

const CustomSelect = styled(Select)({
  // Target the outlined border
  "& .MuiOutlinedInput-root": {
    "& .MuiOutlinedInput-notchedOutline": {
      border: "none", // removes the border
    },
  },
  "& fieldset": {
    border: "none",
  },

  "& .MuiSelect-select": fieldStyles,
});

const Profile = () => {
  // #### STATE ####
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [clientProfile, setClientProfile] = useState<ClientProfile>({
    uid: "",
    firstName: "",
    lastName: "",
    houseNumber: "",
    streetName: "",
    zipCode: "",
    address: "",
    dob: "",
    deliveryFreq: "",
    phone: "",
    alternativePhone: "",
    adults: 0,
    children: 0,
    total: 0,
    gender: "Male",
    ethnicity: "",
    deliveryDetails: {
      deliveryInstructions: "",
      dietaryRestrictions: {
        lowSugar: false,
        kidneyFriendly: false,
        vegan: false,
        vegetarian: false,
        halal: false,
        microwaveOnly: false,
        softFood: false,
        lowSodium: false,
        noCookingEquipment: false,
        foodAllergens: [],
        other: [],
      },
    },
    lifeChallenges: "",
    notes: "",
    lifestyleGoals: "",
    language: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const [isNewProfile, setIsNewProfile] = useState(true);
  const [editMode, setEditMode] = useState(true);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [fieldEditStates, setFieldEditStates] = useState<{ [key: string]: boolean }>(
    {}
  );
  const navigate = useNavigate();
  const [formData, setFormData] = useState({});
  const [clientId, setClientId] = useState<string | null>(null); // Allow clientId to be either a string or null
  const [isSaved, setIsSaved] = useState(false); // Tracks whether it's the first save
  const [isEditing, setIsEditing] = useState(false); // Global editing state

  const params = useParams(); // Params will return an object containing route params (like { id: 'some-id' })
  const id: string | null = params.id ?? null; // Use optional chaining to get the id or null if undefined

  // Function to fetch profile data by ID
  const getProfileById = async (id: string) => {
    const docRef = doc(db, "clients", id); // Assuming you're using Firestore
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as ClientProfile; // Assuming your Firestore documents match the ClientProfile type
    } else {
      console.log("No such document!");
      return null; // Return null if no profile found
    }
  };

  //Route Protection
  React.useEffect(()=>{
    if(auth.currentUser === null){
      console.log("user: ", auth)
      navigate("/");
    }
  },[])

  // Check if we are editing an existing profile or creating a new one
  useEffect(() => {
    if (id) {
      // We're editing an existing profile
      setIsNewProfile(false);
      setClientId(id); // Set the clientId state to the ID from params
      // Fetch profile data based on the ID
      getProfileById(id).then((profileData) => {
        if (profileData) {
          setClientProfile(profileData); // Update the clientProfile state
        } else {
          console.log("No profile found for ID:", id);
        }
      });
    } else {
      // New profile creation: Initialize the clientProfile with default values
      setIsNewProfile(true);
      setClientProfile({
        ...clientProfile, // Make sure to keep the default structure
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }, [id]); // Only re-run when the ID changes

  // Improved type definitions
  type DietaryRestrictions = {
    lowSugar: boolean;
    kidneyFriendly: boolean;
    vegan: boolean;
    vegetarian: boolean;
    halal: boolean;
    microwaveOnly: boolean;
    softFood: boolean;
    lowSodium: boolean;
    noCookingEquipment: boolean;
    foodAllergens: string[];
    other: string[];
  };

  type DeliveryDetails = {
    deliveryInstructions: string;
    dietaryRestrictions: DietaryRestrictions;
  };

  type ClientProfile = {
    uid: string;
    firstName: string;
    lastName: string;
    houseNumber: string;
    streetName: string;
    zipCode: string;
    address: string;
    dob: string;
    deliveryFreq: string;
    phone: string;
    alternativePhone: string;
    adults: number;
    children: number;
    total: number;
    gender: "Male" | "Female" | "Other";
    ethnicity: string;
    deliveryDetails: DeliveryDetails;
    lifeChallenges: string;
    notes: string;
    lifestyleGoals: string;
    language: string;
    createdAt: Date;
    updatedAt: Date;
  };

  // Type for all possible field paths including nested ones
  type NestedKeyOf<T> = {
    [K in keyof T]: T[K] extends object ? `${string & K}.${string & keyof T[K]}` : K;
  }[keyof T];

  // Create a type for all possible keys in ClientProfile, including nested paths
  type ClientProfileKey =
    | keyof ClientProfile
    | "deliveryDetails.dietaryRestrictions"
    | "deliveryDetails.deliveryInstructions";

  type InputType =
    | "text"
    | "date"
    | "number"
    | "select"
    | "textarea"
    | "checkbox"
    | "dietaryRestrictions";
  const calculateAge = (dob: Date) => {
    const diff = Date.now() - dob.getTime();
    const ageDt = new Date(diff);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  // Generate and validate unique 12-digit UID
  const generateUID = async (): Promise<string> => {
    while (true) {
      const uid = Math.floor(Math.random() * 1000000000000)
        .toString()
        .padStart(12, "0");
      const clientsRef = collection(db, "clients");
      const q = query(clientsRef, where("uid", "==", uid));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return uid;
      }
    }
  };

  // Update the toggleFieldEdit function to be type-safe
  const toggleFieldEdit = (fieldName: ClientProfileKey) => {
    setFieldEditStates((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
  };

  const toggleEditMode = () => {
    setEditMode((prev) => !prev);
  };

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
      | SelectChangeEvent
  ) => {
    const { name, value } = e.target;

    if (name === "dob") {
      const newDob = e.target.value; // this will be in the format YYYY-MM-DD
      setClientProfile((prevState) => ({
        ...prevState,
        dob: newDob,
      }));
    } else if (name === "adults" || name === "children") {
      setClientProfile((prevState) => ({
        ...prevState,
        [name]: Number(value),
      }));
    } else if (name === "phone" || name === "alternativePhone") {
      const numericValue = value.replace(/\D/g, "");
      setClientProfile((prevState) => ({
        ...prevState,
        [name]: numericValue,
      }));
    } else {
      setClientProfile((prevState) => ({
        ...prevState,
        [name]: value,
      }));
    }
  };

  const validateProfile = () => {
    const newErrors: { [key: string]: string } = {};

    if (!clientProfile.firstName.trim())
      newErrors.firstName = "First Name is required";
    if (!clientProfile.lastName.trim()) newErrors.lastName = "Last Name is required";
    if (!clientProfile.address.trim()) newErrors.address = "Address is required";
    if (!clientProfile.dob) newErrors.dob = "Date of Birth is required";
    if (!clientProfile.deliveryFreq.trim())
      newErrors.deliveryFreq = "Delivery Frequency is required";
    if (!clientProfile.phone.trim()) newErrors.phone = "Phone is required";
    if (!clientProfile.gender.trim()) newErrors.gender = "Gender is required";
    if (!clientProfile.ethnicity.trim())
      newErrors.ethnicity = "Ethnicity is required";
    if (!clientProfile.language.trim()) newErrors.language = "Language is required";
    if (clientProfile.adults === 0 && clientProfile.children === 0) {
      newErrors.total = "At least one adult or child is required";
    }
    if (!/^\d{10}$/.test(clientProfile.phone)) {
      newErrors.phone = "Phone number must be exactly 10 digits";
    }

    if (
      !/^\d{10}$/.test(clientProfile.alternativePhone) &&
      clientProfile.alternativePhone.trim()
    ) {
      newErrors.alternativePhone =
        "Alternative Phone number must be exactly 10 digits";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateProfile()) {
      console.log("Invalid Profile");
      return;
    }

    try {
      if (isNewProfile) {
        // Generate new UID for new profile
        const newUid = await generateUID();
        const newProfile = {
          ...clientProfile,
          uid: newUid,
          createdAt: new Date(),
          updatedAt: new Date(),
          dob: clientProfile.dob, // Store the date as a string
          total: clientProfile.adults + clientProfile.children,
        };

        // Save to Firestore for new profile
        await setDoc(doc(db, "clients", newUid), newProfile);
        setClientProfile(newProfile);
        setIsNewProfile(false);
        setEditMode(false);
        setIsEditing(false);
        console.log("New profile created with ID: ", newUid);

        // Navigate to the newly created profile
        navigate(`/profile/${newUid}`);
      } else {
        // Update only changed fields for existing profile
        const updatedFields = {
          ...clientProfile,
          updatedAt: new Date(),
          dob: clientProfile.dob, // Store the date as a string
          total: clientProfile.adults + clientProfile.children,
        };

        await setDoc(doc(db, "clients", clientProfile.uid), updatedFields, {
          merge: true,
        });
        setEditMode(false);
        setIsEditing(false);
        // Reset all field edit states
        setFieldEditStates({});
        console.log("Profile updated: ", clientProfile.uid);

        // Navigate to the updated profile page
        navigate(`/profile/${clientProfile.uid}`);
      }
    } catch (e) {
      console.error("Error saving document: ", e);
    }
  };

  // Helper function to get nested values
  const getNestedValue = (obj: any, path: string) => {
    return path.split(".").reduce((acc, part) => acc?.[part], obj);
  };

  const renderField = (fieldPath: ClientProfileKey, type: InputType = "text") => {
    const value = fieldPath.includes(".")
      ? getNestedValue(clientProfile, fieldPath)
      : clientProfile[fieldPath as keyof ClientProfile];

  if (fieldPath === "deliveryDetails.dietaryRestrictions") {
    return renderDietaryRestrictions();
  }

    if (isEditing) {
      switch (type) {
        case "select":
          if (fieldPath === "gender") {
            return (
              <CustomSelect
                name={fieldPath}
                value={value as string}
                onChange={(e) => handleChange(e as SelectChangeEvent<string>)}
                style={{ width: "83.5%" }}
              >
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </CustomSelect>
            );
          }
          break;

        case "date":
          return (
            <>
              <CustomTextField
                type="date"
                name={fieldPath}
                value={
                  value instanceof Date
                    ? value.toISOString().split("T")[0]
                    : value || ""
                }
                onChange={handleChange}
                fullWidth
              />
            </>
          );

        case "number":
          return (
            <CustomTextField
              type="number"
              name={fieldPath}
              value={value as number}
              onChange={handleChange}
              fullWidth
            />
          );

        case "textarea":
          return (
            <CustomTextField
              name={fieldPath}
              value={String(value || "")}
              onChange={handleChange}
              multiline
              // rows={4}
              fullWidth
            />
          );

        default:
          return (
            <>
              {/* <TextFieldInput descriptor={fieldPath} handleChange={handleChange} /> */}
              <CustomTextField
                type="text"
                name={fieldPath}
                value={String(value || "")}
                onChange={handleChange}
                fullWidth
              />
            </>
          );
      }
    }

    return (
      <Typography variant="body1" sx={{ fontWeight: 600 }}>
        {renderFieldValue(fieldPath, value)}
      </Typography>
    );
  };

  // Helper function to render field values properly
  const renderFieldValue = (fieldPath: string, value: any) => {
    if (fieldPath === "dob") {
      console.log(value);
      let dobDate;

      // Check if the value is a Date object, Timestamp, or string
      if (value instanceof Date) {
        // If it's already a Date object, use it directly
        dobDate = value;
      } else if (value instanceof Timestamp) {
        // If it's a Firestore Timestamp, convert it to a Date object
        dobDate = value.toDate();
      } else if (typeof value === "string") {
        // If it's a string, try to create a Date object from it
        dobDate = new Date(value);
        console.log(dobDate);
      } else {
        // If the value is neither a Date, Timestamp, nor string, handle it as invalid
        dobDate = new Date();
      }

      // Ensure dobDate is valid
      if (isNaN(dobDate.getTime())) {
        dobDate = new Date(); // Fallback to current date if invalid
      }

      // Format the date and calculate the age
      const formattedDate = dobDate.toUTCString().split(" ").slice(0, 4).join(" ");
      console.log(formattedDate);
      const age = calculateAge(dobDate);

      return `${formattedDate} (Age ${age})`;
    }
    if (fieldPath === "gender") {
      return value as string;
    }
    if (fieldPath === "deliveryDetails.dietaryRestrictions") {
      return (
        Object.entries(value as DietaryRestrictions)
          .filter(([key, val]) => val === true && typeof val === "boolean")
          .map(([key]) => key.replace(/([A-Z])/g, " $1").trim())
          .join(", ") || "None"
      );
    }
    return String(value || "N/A");
  };

  const capitalizeFirstLetter = (value: string) => {
    return value[0].toUpperCase() + value.slice(1);
  };

  const renderDietaryRestrictions = () => {
    const restrictions = clientProfile.deliveryDetails.dietaryRestrictions;

    if (isEditing) {
      return (
        <Grid2 container spacing={1}>
          {Object.entries(restrictions)
            .filter(([key, value]) => typeof value === "boolean")
            .map(([key, value]) => (
              <Grid2 key={key}>
                <FormControlLabel
                  sx={{ textAlign: "left" }}
                  control={
                    <Checkbox
                      name={key}
                      checked={value as boolean}
                      onChange={handleDietaryRestrictionChange}
                    />
                  }
                  label={capitalizeFirstLetter(
                    key.replace(/([A-Z])/g, " $1").trim()
                  )}
                />
              </Grid2>
            ))}
        </Grid2>
      );
    }

    return (
      <Typography variant="body1" sx={{ fontWeight: 600 }}>
        {Object.entries(restrictions)
          .filter(([key, value]) => value === true && typeof value === "boolean")
          .map(([key]) => key.replace(/([A-Z])/g, " $1").trim())
          .join(", ") || "None"}
      </Typography>
    );
  };

  // Updated handler for dietary restrictions
  const handleDietaryRestrictionChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, checked } = e.target;
    setClientProfile((prevState) => ({
      ...prevState,
      deliveryDetails: {
        ...prevState.deliveryDetails,
        dietaryRestrictions: {
          ...prevState.deliveryDetails.dietaryRestrictions,
          [name]: checked,
        },
      },
    }));
  };

  const fieldLabelStyles = {
    fontWeight: 700,
    marginBottom: !isEditing ? "12px" : "0",
    textAlign: "left",
    fontSize: {
      xs: "16px",
      md: "14px",
      lg: "16px",
    },
  };

  return (
    <Box className="profile-container">
      <Box className="white-container">
        <Typography
          variant="h5"
          className="border-bottom"
          style={{ marginBottom: 20 }}
        >
          {clientProfile.firstName?.trim() || clientProfile.lastName?.trim()
            ? `${clientProfile.firstName || ""} ${clientProfile.lastName || ""}`.trim()
            : "Welcome!"}
        </Typography>
        <Box
          display="flex"
          alignItems="center"
          borderBottom="2px solid green"
          pb={0.5}
          sx={{ width: "min-content" }}
        >
          {/* Person Icon */}
          <PersonIcon style={{ marginRight: 3, color: "green" }} />

          {/* Text */}
          <Typography variant="body1" sx={{ fontWeight: 800, color: "green" }}>
            OVERVIEW
          </Typography>
        </Box>
      </Box>

      <Box className="profile-main">
        <Box className="centered-box">
          <Box
            className="box-header"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            {/* Title on the left */}
            <Typography
              className="basic-info-title"
              sx={{ fontWeight: 500, fontSize: { xs: "20px", sm: "24px" } }}
            >
              Basic Information
            </Typography>

            {/* Buttons on the right */}
            <Box display="flex" alignItems="center" gap={1} marginBottom={1}>
              <IconButton
                sx={{ color: "green" }}
                onClick={() => setIsEditing((prev) => !prev)}
                color={isEditing ? "secondary" : "primary"}
              >
                <Tooltip title={isEditing ? "Cancel Editing" : "Edit All"}>
                  {isEditing ? <CloseIcon /> : <EditIcon />}
                </Tooltip>
              </IconButton>
              {isEditing && (
                <IconButton
                  sx={{ color: "green" }}
                  color="primary"
                  onClick={handleSave}
                  aria-label="save"
                >
                  <SaveIcon />
                </IconButton>
              )}
            </Box>
          </Box>

          <Box
            sx={{
              display: "grid",
              gap: isEditing ? 3 : 5, // Spacing between grid items
              gridTemplateColumns: {
                xs: "1fr", // Full width for small screens
                sm: "repeat(2, 1fr)", // Three columns for medium screens and up
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

            {/* Address */}
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
              {/* <h1 className="field-descriptor">GENDER</h1> */}
              {renderField("gender", "select")}
              {errors.gender && (
                <Typography color="error" variant="body2">
                  {errors.gender}
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

            {/* Adults */}
            <Box>
              <Typography className="field-descriptor" sx={fieldLabelStyles}>
                ADULTS <span className="required-asterisk">*</span>
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
                CHILDREN <span className="required-asterisk">*</span>
              </Typography>
              {renderField("children", "number")}
              {errors.children && (
                <Typography color="error" variant="body2">
                  {errors.children}
                </Typography>
              )}
            </Box>

            {/* Delivery Frequency */}
            <Box>
              <Typography className="field-descriptor" sx={fieldLabelStyles}>
                DELIVERY FREQUENCY <span className="required-asterisk">*</span>
              </Typography>
              {renderField("deliveryFreq", "text")}
              {errors.deliveryFreq && (
                <Typography color="error" variant="body2">
                  {errors.deliveryFreq}
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

            {/* Notes */}
            <Box>
              <Typography className="field-descriptor" sx={fieldLabelStyles}>
                NOTES
              </Typography>
              {renderField("notes", "textarea")}
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

            {/* Dietary Restrictions, truncate is when not editing, put it on its own row */}
            <Box sx={{ gridColumn: isEditing ? "-1/1" : "" }}>
              <Typography className="field-descriptor" sx={fieldLabelStyles}>
                DIETARY RESTRICTIONS
              </Typography>
              {renderField(
                "deliveryDetails.dietaryRestrictions",
                "dietaryRestrictions"
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Profile;
