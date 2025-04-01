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
  orderBy,
  updateDoc,
  where,
  limit,
} from "firebase/firestore";
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db, auth } from "../../auth/firebaseConfig";
import "./Profile.css";

import { Timestamp } from "firebase/firestore";
import TagPopup from "./Tags/TagPopup";
import { StringLiteral } from "typescript";

declare global {
  interface Window {
    google: any;
  }
}

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
      border: "none",
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
  const [tags, setTags] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [clientProfile, setClientProfile] = useState<ClientProfile>({
    uid: "",
    firstName: "",
    lastName: "",
    streetName: "",
    zipCode: "",
    address: "",
    address2: "",
    city: "",
    state: "",
    quadrant: "",
    dob: "",
    phone: "",
    alternativePhone: "",
    adults: 0,
    children: 0,
    total: 0,
    seniors: 0,
    headOfHousehold: "Adult",
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
    notesTimestamp: null,
    lifestyleGoals: "",
    language: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    startDate: "",
    endDate: "",
    recurrence: "None",
    tags: [],
    ward: ""
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
  const [ward, setWard] = useState(clientProfile.ward);
  const [isEditing, setIsEditing] = useState(false); // Global editing state
  const [lastDeliveryDate, setLastDeliveryDate] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false); // Track if profile is loaded
  const [prevNotes, setPrevNotes] = useState("");
  const params = useParams(); // Params will return an object containing route params (like { id: 'some-id' })
  const id: string | null = params.id ?? null; // Use optional chaining to get the id or null if undefined
  const [showSavePopup, setShowSavePopup] = useState(false);

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
  React.useEffect(() => {
    if (auth.currentUser === null) {
      navigate("/");
    }
  }, [])



  //get list of all tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const tagsDocRef = doc(db, "tags", "oGuiR2dQQeOBXHCkhDeX");
        const tagsDocSnap = await getDoc(tagsDocRef);

        if (tagsDocSnap.exists()) {
          const tagsArray = tagsDocSnap.data().tags;
          setAllTags(tagsArray);
        } else {
          console.log("No tags document found!");
          setAllTags([]);
        }
      } catch (error) {
        console.error("Error fetching tags:", error);
      }
    };

    fetchTags();
  }, []);

  useEffect(() => {
    if (id) {
      setIsNewProfile(false);
      setClientId(id);
      getProfileById(id).then((profileData) => {
        if (profileData) {
          setTags(profileData.tags.filter((tag) => allTags.includes(tag)) || []);
          setClientProfile(profileData);
  
          // Set prevNotes only when the profile is loaded from Firebase
          if (!profileLoaded) {
            setPrevNotes(profileData.notes || ""); // Set the original notes
            setProfileLoaded(true); // Mark the profile as loaded
          }
        } else {
          console.log("No profile found for ID:", id);
        }
      });
    } else {
      setIsNewProfile(true);
      setClientProfile({
        ...clientProfile,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setTags([]);
    }
  }, [id, allTags, profileLoaded]); // Include profileLoaded to prevent re-setting prevNotes

  useEffect(() => {
    const fetchLastDeliveryDate = async () => {
      if (clientId) {
        try {
          const eventsRef = collection(db, "events");
          const q = query(
            eventsRef,
            where("clientId", "==", clientId),
            orderBy("deliveryDate", "desc"),
            limit(1)
          );
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const lastEvent = querySnapshot.docs[0].data();
            const deliveryDate = lastEvent.deliveryDate.toDate();
            setLastDeliveryDate(deliveryDate.toISOString().split("T")[0]); // Format as YYYY-MM-DD in UTC
          } else {
            setLastDeliveryDate("No deliveries found");
          }
        } catch (error) {
          console.error("Error fetching last delivery date:", error);
          setLastDeliveryDate("Error fetching data");
        }
      }
    };

    fetchLastDeliveryDate();
  }, [clientId]);

  useEffect(() => {
    const fetchWard = async () => {
      if (clientProfile.address.trim()) {
        await getWard(clientProfile.address);
      }
    };
  
    fetchWard();
  }, [clientProfile.address]); // Runs whenever the address field changes

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
    streetName: string;
    zipCode: string;
    address: string;
    address2: string;
    city: string;
    state: string;
    quadrant: string;
    dob: string;
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
    notesTimestamp?: {
      notes: string,
      timestamp: Date
    } | null;
    lifestyleGoals: string;
    language: string;
    createdAt: Date;
    updatedAt: Date;
    startDate: string;
    endDate: string;
    recurrence: string;
    tags: string[];
    ward: string;
    seniors: number;
    headOfHousehold: "Senior" | "Adult";
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
    | "tags"
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

  const getWard = async (searchAddress: string) => {
    console.log("getting ward")
    const baseurl = "https://datagate.dc.gov/mar/open/api/v2.2";
    const apikey = process.env.REACT_APP_DC_WARD_API_KEY;
    const marURL = baseurl + "/locations/";
    const marZone = "ward";
    let wardName;

    // Construct the URL with query parameters
    const marGeocodeURL = new URL(marURL + searchAddress + "/" + marZone + "/true");
    const params = new URLSearchParams();
    if (apikey) {
      params.append("apikey", apikey);
    } else {
      console.error("API key is undefined");
    }
    marGeocodeURL.search = params.toString();

    try {
      // Make the API request
      const response = await fetch(marGeocodeURL.toString());

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Parse the JSON response
      const data = await response.json();

      // Check if the response is successful and contains the expected data
      if (data.Success === true && data.Result.addresses && data.Result.addresses.length > 0) {
        const result = data.Result.addresses[0];

        if (result.zones && result.zones.ward[0]) {
          wardName = result.zones.ward[0].properties.NAME;
        } else {
          console.log("No ward information found in the response.");
          wardName = "No ward information"
        }
      } else {
        console.log("No address found or invalid response.");
        wardName = "No address found"
      }
    } catch (error) {
      console.error("Error fetching ward information:", error);
      wardName = "Error getting ward"
    }
    clientProfile.ward = wardName;
    setWard(wardName);
    return wardName;
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

    // Always mark as unsaved when a change occurs
    setIsSaved(false);

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
      
      // Special handling for notes field
      if (name === "notes") {
        console.log("Notes changed to:", value);
      }
    }
  };

  const validateProfile = () => {
    const newErrors: { [key: string]: string } = {};

    if (!clientProfile.firstName?.trim())
      newErrors.firstName = "First Name is required";
    if (!clientProfile.lastName?.trim())
      newErrors.lastName = "Last Name is required";
    if (!clientProfile.address?.trim())
      newErrors.address = "Address 1 is required";
    if (!clientProfile.zipCode)
      newErrors.zipCode = "Zip code is required";
    if (!clientProfile.city)
      newErrors.city = "City is required";
    if (!clientProfile.state)
      newErrors.state = "State is required";
    if (!clientProfile.dob)
      newErrors.dob = "Date of Birth is required";
    if (!clientProfile.recurrence.trim())
      newErrors.recccurence = "Reccurence is required";
    if (!clientProfile.startDate.trim())
      newErrors.startDate = "Start Date is required";
    if (!clientProfile.endDate.trim())
      newErrors.endDate = "End Date is required";
    if (!clientProfile.phone?.trim())
      newErrors.phone = "Phone is required";
    if (!clientProfile.gender?.trim())
      newErrors.gender = "Gender is required";
    if (!clientProfile.ethnicity?.trim())
      newErrors.ethnicity = "Ethnicity is required";
    if (!clientProfile.language.trim()) newErrors.language = "Language is required";
    if (clientProfile.adults === 0 && clientProfile.seniors === 0) {
      newErrors.total = "At least one adult or senior is required";
    }
    if (!/^\d{10}$/.test(clientProfile.phone || "")) {
      newErrors.phone = "Phone number must be exactly 10 digits";
    }

    if (
      clientProfile.alternativePhone &&
      !/^\d{10}$/.test(clientProfile.alternativePhone)
    ) {
      newErrors.alternativePhone =
        "Alternative Phone number must be exactly 10 digits";
    }

    setErrors(newErrors);
    console.log(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkIfNotesExists = (notes: string, prevNotesTimestamp: { notes: string; timestamp: Date } | null) => {
    if (!prevNotesTimestamp && notes.trim() !== "") {
      return { notes, timestamp: new Date() };
    }

    return prevNotesTimestamp;
  };

  const checkIfNotesChanged = (
    prevNotes: string,
    newNotes: string,
    prevNotesTimestamp: { notes: string; timestamp: Date } | null
  ) => {
    // Compare trimmed versions of notes to avoid whitespace issues
    if (prevNotes.trim() !== newNotes.trim()) {
      console.log("Notes changed from:", prevNotes.trim(), "to:", newNotes.trim());
      return { notes: newNotes, timestamp: new Date() };
    }
    return prevNotesTimestamp;
  };

  const handleSave = async () => {
    if (!validateProfile()) {
      console.log("Invalid Profile");
      return;
    }
  
    try {
      const currNotes = clientProfile.notes;
  
      let updatedNotesTimestamp = checkIfNotesExists(currNotes, clientProfile.notesTimestamp ?? null);
      updatedNotesTimestamp = checkIfNotesChanged(prevNotes, currNotes, updatedNotesTimestamp);
  
      console.log("Previous notes:", prevNotes);
      console.log("Current notes:", currNotes);
      console.log("Timestamp updated:", updatedNotesTimestamp !== clientProfile.notesTimestamp);
      
      // Update the clientProfile object with the latest tags state
      const updatedProfile = {
        ...clientProfile,
        tags: tags, // Sync the tags state with clientProfile
        notesTimestamp: updatedNotesTimestamp, // Update the notesTimestamp
        updatedAt: new Date(),
        total: clientProfile.adults + clientProfile.children + clientProfile.seniors,
        ward: await getWard(clientProfile.address)
      };
  
      const sortedAllTags = [...allTags].sort((a, b) => a.localeCompare(b));
  
      if (isNewProfile) {
        // Generate new UID for new profile
        const newUid = await generateUID();
        const newProfile = {
          ...updatedProfile,
          uid: newUid,
          createdAt: new Date(),
        };
  
        // Save to Firestore for new profile
        await setDoc(doc(db, "clients", newUid), newProfile);
        await setDoc(doc(db, "tags", "oGuiR2dQQeOBXHCkhDeX"), { tags: sortedAllTags });
        setClientProfile(newProfile);
        setIsNewProfile(false);
        console.log("New profile created with ID: ", newUid);
        navigate(`/profile/${newUid}`);
      } else {
        // Update existing profile
        await setDoc(doc(db, "clients", clientProfile.uid), updatedProfile, {
          merge: true,
        });
        await setDoc(doc(db, "tags", "oGuiR2dQQeOBXHCkhDeX"), { tags: sortedAllTags }, {
          merge: true,
        });
        setClientProfile(updatedProfile);
      }
  
      // Make sure we update prevNotes with the current notes value to track changes properly
      setPrevNotes(currNotes); 
      console.log("Updated prevNotes to:", currNotes);
      
      // Update UI state
      setIsSaved(true);
      setEditMode(false);
      setIsEditing(false);
      
      // Show save popup
      setShowSavePopup(true);
      // Hide popup after 2 seconds
      setTimeout(() => setShowSavePopup(false), 2000);
      
    } catch (e) {
      console.error("Error saving document: ", e);
    }
  };

  // Helper function to get nested values
  const getNestedValue = (obj: any, path: string) => {
    return path.split(".").reduce((acc, part) => acc?.[part], obj);
  };

  const renderField = (fieldPath: ClientProfileKey, type: InputType = "text") => {
    let value = fieldPath.includes(".")
      ? getNestedValue(clientProfile, fieldPath)
      : clientProfile[fieldPath as keyof ClientProfile];

        const handleTag = (text: any) => {
        if (tags.includes(text)) {
          const updatedTags = tags.filter((t) => t !== text);
          setTags(updatedTags); 
        } 
        else if(text.trim() != ""){
          const updatedTags = [...tags, text.trim()]; 
          setTags(updatedTags); 
        }
      };

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
            <>
              <CustomTextField
                type="number"
                name={fieldPath}
                value={value as number}
                onChange={handleChange}
                fullWidth
              />
            </>
          );

        case "textarea":
          if (fieldPath == "ward") {
            return (
              <CustomTextField
                name={fieldPath}
                value={String(value || "")}
                disabled
                fullWidth
              />
            );
          }
          else {
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
          }
        case "tags":
          return (
            <>
              <Box sx={{ textAlign: 'left' }}>
                {
                  tags.length > 0 ? (<p>{tags.join(", ")}</p>) : <p>No tags selected</p>
                }
              </Box>
              <Button
                variant="contained"
                // startIcon={<Add />}
                onClick={() => { setIsModalOpen(true); }}
                sx={{
                  marginRight: 4,
                  width: 166,
                  color: "#fff",
                  backgroundColor: "#257E68",
                }}
              >
                Edit Tags
              </Button>
              <TagPopup
                allTags={allTags}
                tags={tags}
                handleTag={handleTag}
                isModalOpen={isModalOpen}
                setIsModalOpen={setIsModalOpen}>
              </TagPopup>
            </>
          );
        default:
          return (
            <>
              {/* <TextFieldInput descriptor={fieldPath} handleChange={handleChange} /> */}
              <CustomTextField
        type="text"
        name={fieldPath}
        value={fieldPath === "ward" ? ward : String(value || "")}
        onChange={handleChange}
        onBlur={async () => {
          if (fieldPath === "address") {
            // Call getWard with the updated address1 value
            await getWard(clientProfile.address);
          }
        }}
        fullWidth
        inputRef={fieldPath === "address" ? addressInputRef : null}
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
      const age = calculateAge(dobDate);

      return `${formattedDate} (Age ${age})`;
    }
    if (fieldPath === "gender") {
      return value as string;
    }
    if (fieldPath === "tags") {
      value = (tags.length > 0 ? tags : "None");
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

    const selectedRestrictions = Object.entries(restrictions)
      .filter(([key, value]) => value === true && typeof value === "boolean")
      .map(([key]) => key.replace(/([A-Z])/g, " $1").trim())
      .join(", ") || "None";

    return (
      <CustomTextField
        name="dietaryRestrictionsSummary"
        value={selectedRestrictions}
        disabled
        fullWidth
      />
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

  //google places autocomplete
  //this ends up being used in renderField
  const addressInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if(isEditing) {
      // check if the Google Maps API script is already loaded
      const script = document.createElement('script');
      if (!window.google) {
        
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY || ""}&libraries=places`;
        script.async = true;
        script.defer = true;
        
        // initialize autocomplete when script loading finishes
        script.onload = () => {
          if (addressInputRef.current) {
            const autocomplete = new window.google.maps.places.Autocomplete(
              addressInputRef.current,
              { 
                types: ['address'],
                componentRestrictions: { country: 'us' } 
              }
            );
            
            autocomplete.addListener('place_changed', () => {
              const place = autocomplete.getPlace();
              if (place.formatted_address) {
                console.log(place);
                let address = place.formatted_address;
                // address components in json format
                const addressComponents = place.address_components;
                console.log(address);
                
                let streetNumber = '';
                let streetName = '';
                let city = '';
                let state = '';
                let zipCode = '';
                let quadrant = ''; 
                
                // getting relevant components
                if (addressComponents) {
                  for (const component of addressComponents) {
                    const types = component.types;
                    
                    if (types.includes('street_number')) {
                      streetNumber = component.long_name;
                    }
                    
                    if (types.includes('route')) {
                      streetName = component.long_name;
                    }
                    
                    if (types.includes('locality') || types.includes('sublocality')) {
                      city = component.long_name;
                    }
                    
                    if (types.includes('administrative_area_level_1')) {
                      state = component.short_name; // Use short_name for state code (e.g., "DC" instead of "District of Columbia")
                    }
                    
                    if (types.includes('postal_code')) {
                      zipCode = component.long_name;
                    }
                  }
                  
                  // using regex to look for quadrant
                  const quadrantMatch = address.match(/(NW|NE|SW|SE)(\s|,|$)/);
                  if (state === "DC" && quadrantMatch) {
                    quadrant = quadrantMatch[1];
                  }

                  //TODO: DELETE
                  console.log('Street Number:', streetNumber);
                  console.log('Street Name:', streetName);
                  console.log('City:', city);
                  console.log('State:', state);
                  console.log('Zip Code:', zipCode);
                  console.log('Quadrant:', quadrant);
                }
                
                // Update the client profile with all the parsed components
                setClientProfile(prev => ({
                  ...prev,
                  address: `${streetNumber} ${streetName}`.trim(),
                  city: city,
                  state: state,
                  zipCode: zipCode,
                  quadrant: quadrant
                }));
              }
            });
          }
        };
        
        document.head.appendChild(script);
      } 
    }
    return () => {

    }
  }, [isEditing])
  
  
  return (
    <Box className="profile-container">
      {showSavePopup && (
        <Box
          sx={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#257e68',
            color: 'white',
            padding: '16px',
            borderRadius: '4px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            zIndex: 1000,
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          Profile saved successfully!
        </Box>
      )}
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
    ADDRESS<span className="required-asterisk">*</span>
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
  <CustomTextField
    type="text"
    name="address2"
    value={clientProfile.address2 || ""}
    onChange={(e) => {
      const { value } = e.target;
      setClientProfile((prevState) => ({
        ...prevState,
        address2: value, // Update address2 without triggering getWard
      }));
    }}
    fullWidth
  />
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
  <CustomTextField
    type="text"
    name="city"
    value={clientProfile.city || ""}
    disabled
    fullWidth
  />
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
  <CustomTextField
    type="text"
    name="state"
    value={clientProfile.state || ""}
    disabled
    fullWidth
  />
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
  <CustomTextField
    type="text"
    name="zipCode"
    value={clientProfile.zipCode || ""}
    disabled
    fullWidth
  />
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
  <CustomTextField
    type="text"
    name="quadrant"
    value={clientProfile.quadrant || ""}
    disabled
    fullWidth
  />
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

            {/* Ward */}
            <Box>
              <Typography className="field-descriptor" sx={fieldLabelStyles}>
                WARD
              </Typography>
              {renderField("ward", "textarea")}
            </Box>

            {/* Seniors */}
            <Box>
              <Typography className="field-descriptor" sx={fieldLabelStyles}>
                SENIORS <span className="required-asterisk">*</span>
              </Typography>
              {renderField("seniors", "number")}
              {errors.children && (
                <Typography color="error" variant="body2">
                  {errors.children}
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

            {/* Total */}
            <Box>
              <Typography
                className="field-descriptor"
                sx={{
                  ...fieldLabelStyles,
                  position: "relative",
                  top: isEditing ? "-19px" : "0",
                }}
              >
                TOTAL
              </Typography>
              <CustomTextField
                type="text"
                name="total"
                value={Number(clientProfile.seniors) + Number(clientProfile.adults) + Number(clientProfile.children)}
                disabled
                fullWidth
              />
            </Box>

            {/* Head of Household */}
            <Box>
              <Typography className="field-descriptor" sx={fieldLabelStyles}>
                HEAD OF HOUSEHOLD
              </Typography>
              {isEditing ? (
                <CustomSelect
                  name="headOfHousehold"
                  value={clientProfile.headOfHousehold || ""}
                  onChange={(e) => {
                    const { value } = e.target;
                    setClientProfile((prevState) => ({
                      ...prevState,
                      headOfHousehold: value as "Adult" | "Senior",
                    }));
                  }}
                  fullWidth
                >
                  <MenuItem value="Adult">Adult</MenuItem>
                  <MenuItem value="Senior">Senior</MenuItem>
                </CustomSelect>
              ) : (
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {clientProfile.headOfHousehold || "N/A"}
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
                    setClientProfile((prevState) => ({
                      ...prevState,
                      recurrence: value as "Weekly" | "2x-Monthly" | "Monthly",
                    }));
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
    Last edited: {(clientProfile.notesTimestamp?.timestamp instanceof Timestamp
      ? clientProfile.notesTimestamp.timestamp.toDate()
      : clientProfile.notesTimestamp?.timestamp || clientProfile.createdAt
    ).toLocaleString()}
  </p>
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

            {/* Tags */}
            <Box sx={{}}>
              <Typography className="field-descriptor" sx={fieldLabelStyles}>
                TAGS
              </Typography>
              {renderField("tags", "tags")}
            </Box>

            {/* Dietary Restrictions, truncate is when not editing, put it on its own row */}
            <Box sx={{ gridColumn: isEditing ? "-1/1" : "" }}>
              <Typography className="field-descriptor" sx={fieldLabelStyles}>
                DIETARY RESTRICTIONS
              </Typography>
              {isEditing ? (
                renderField("deliveryDetails.dietaryRestrictions", "dietaryRestrictions")
              ) : (
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {Object.entries(clientProfile.deliveryDetails.dietaryRestrictions)
                    .filter(([key, value]) => value === true && typeof value === "boolean")
                    .map(([key]) =>
                      key
                        .replace(/([A-Z])/g, " $1") // Add space before capital letters
                        .trim()
                        .split(" ") // Split into words
                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
                        .join(" ") // Join back into a single string
                    )
                    .join(", ") || "None"}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Profile;
