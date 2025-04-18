import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import PersonIcon from "@mui/icons-material/Person";
import SaveIcon from "@mui/icons-material/Save";
import {
  Autocomplete,
  Box,
  Button,
  IconButton,
  MenuItem,
  SelectChangeEvent,
  TextField,
  Tooltip,
  Typography,
  styled,
} from "@mui/material";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth, db } from "../../auth/firebaseConfig";
import CaseWorkerManagementModal from "../../components/CaseWorkerManagementModal";
import "./Profile.css";

// Import new components
import BasicInfoForm from "./components/BasicInfoForm";
import DeliveryInfoForm from "./components/DeliveryInfoForm";
import DietaryPreferencesForm from "./components/DietaryPreferencesForm";
import FormField from "./components/FormField";
import MiscellaneousForm from "./components/MiscellaneousForm";
import ProfileHeader from "./components/ProfileHeader";
import TagPopup from "./Tags/TagPopup";

// Import types
import { CaseWorker, ClientProfile } from "../../types";
import { ClientProfileKey, InputType } from "./types";

// Styling
const fieldStyles = {
  backgroundColor: "white",
  width: "60%",
  height: "1.813rem",
  padding: "0.1rem 0.5rem",
  borderRadius: "5px",
  border: ".1rem solid black",
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

// Type definitions have been moved to types directory
const Profile = () => {
  // #### STATE ####
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [prevTags, setPrevTags] = useState<string[] | null>(null);
  const [prevClientProfile, setPrevClientProfile] = useState<ClientProfile | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfile>({
    uid: "",
    firstName: "",
    lastName: "",
    streetName: "",
    zipCode: "",
    address: "",
    address2: "",
    email: "",
    city: "",
    state: "",
    quadrant: "",
    dob: "",
    deliveryFreq: "",
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
    ward: "",
    tefapCert: "",
  });
  const [isNewProfile, setIsNewProfile] = useState(true);
  const [editMode, setEditMode] = useState(true);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [fieldEditStates, setFieldEditStates] = useState<{ [key: string]: boolean }>({});
  const navigate = useNavigate();
  const [formData, setFormData] = useState({});
  const [clientId, setClientId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [ward, setWard] = useState(clientProfile.ward);
  const [isEditing, setIsEditing] = useState(true);
  const [lastDeliveryDate, setLastDeliveryDate] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [prevNotes, setPrevNotes] = useState("");
  const params = useParams();
  const id: string | null = params.id ?? null;
  const [showSavePopup, setShowSavePopup] = useState(false);
  const [showCaseWorkerModal, setShowCaseWorkerModal] = useState(false);
  const [caseWorkers, setCaseWorkers] = useState<CaseWorker[]>([]);
  const [selectedCaseWorker, setSelectedCaseWorker] = useState<CaseWorker | null>(null);

  // Function to fetch profile data by ID
  const getProfileById = async (id: string) => {
    const docRef = doc(db, "clients", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as ClientProfile;
    } else {
      console.log("No such document!");
      return null;
    }
  };

  //Route Protection
  React.useEffect(() => {
    if (auth.currentUser === null) {
      navigate("/");
    }
  }, [navigate]);

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
            setPrevNotes(profileData.notes || "");
            setProfileLoaded(true);
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
  }, [id, allTags, profileLoaded]);

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
            setLastDeliveryDate(deliveryDate.toISOString().split("T")[0]);
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
  }, [clientProfile.address]);

  // Fetch case workers from Firestore
  useEffect(() => {
    const fetchCaseWorkers = async () => {
      try {
        const caseWorkersCollectionRef = collection(db, "CaseWorkers");
        const querySnapshot = await getDocs(caseWorkersCollectionRef);
        const caseWorkersData: CaseWorker[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          caseWorkersData.push({
            id: doc.id,
            name: data.name || "",
            organization: data.organization || "",
            phone: data.phone || "",
            email: data.email || "",
          });
        });

        setCaseWorkers(caseWorkersData);

        // If the client profile has a referral entity, find and set the matching case worker
        if (clientProfile.referralEntity?.id) {
          const matchingCaseWorker = caseWorkersData.find(
            (cw) => cw.id === clientProfile.referralEntity?.id
          );
          if (matchingCaseWorker) {
            setSelectedCaseWorker(matchingCaseWorker);
          }
        }
      } catch (error) {
        console.error("Error fetching case workers:", error);
      }
    };

    fetchCaseWorkers();
  }, [clientProfile.referralEntity?.id, profileLoaded]);

  const calculateAge = (dob: Date) => {
    const diff = Date.now() - dob.getTime();
    const ageDt = new Date(diff);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  // Generate and validate unique 12-digit UID
  const generateUID = async (): Promise<string> => {
    let isUnique = false;
    while (!isUnique) {
      const uid = Math.floor(Math.random() * 1000000000000)
        .toString()
        .padStart(12, "0");
      const clientsRef = collection(db, "clients");
      const q = query(clientsRef, where("uid", "==", uid));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        isUnique = true;
        return uid;
      }
    }
    return ""; // This line should never be reached
  };

  const getWard = async (searchAddress: string) => {
    console.log("getting ward");
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
          wardName = "No ward information";
        }
      } else {
        console.log("No address found or invalid response.");
        wardName = "No address found";
      }
    } catch (error) {
      console.error("Error fetching ward information:", error);
      wardName = "Error getting ward";
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

  function deepCopy<T>(obj: T): T {
    // If obj is null or not an object, return it (base case)
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    // Handle Date objects
    if (obj instanceof Date) {
      return new Date(obj.getTime()) as T;
    }

    // Handle arrays by recursively copying each element
    if (Array.isArray(obj)) {
      return obj.map((item) => deepCopy(item)) as unknown as T;
    }

    // Handle plain objects by recursively copying each property
    const copy = {} as { [key: string]: any };
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        copy[key] = deepCopy((obj as any)[key]);
      }
    }
    return copy as T;
  }

  const handlePrevClientCopying = () => {
    if (!prevClientProfile) {
      setPrevClientProfile(deepCopy(clientProfile));
    }
  };

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
      | SelectChangeEvent
  ) => {
    const { name, value } = e.target;

    // Always mark as unsaved when a change occurs
    setIsSaved(false);
    handlePrevClientCopying();

    if (name === "dob" || name === "tefapCert") {
      const date = e.target.value; // this will be in the format YYYY-MM-DD
      setClientProfile((prevState) => ({
        ...prevState,
        [name]: date,
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

      // Special handling for deliveryInstructions field
      if (name === "deliveryDetails.deliveryInstructions") {
        setClientProfile((prev) => ({
          ...prev,
          deliveryDetails: {
            ...prev.deliveryDetails,
            deliveryInstructions: value,
          },
        }));
      }
      if (name === "notes") {
        // Special handling for notes field
        console.log("Notes changed to:", value);
      }
    }
  };

  const validateProfile = () => {
    const newErrors: { [key: string]: string } = {};

    // Validate required fields
    if (!clientProfile.firstName?.trim()) {
      newErrors.firstName = "First name is required";
    }
    if (!clientProfile.lastName?.trim()) {
      newErrors.lastName = "Last name is required";
    }
    if (!clientProfile.address?.trim()) {
      newErrors.address = "Address is required";
    }
    if (!clientProfile.zipCode) {
      newErrors.zipCode = "Zip code is required";
    }
    if (!clientProfile.city) {
      newErrors.city = "City is required";
    }
    if (!clientProfile.state) {
      newErrors.state = "State is required";
    }
    if (!clientProfile.dob) {
      newErrors.dob = "Date of Birth is required";
    }
    if (!clientProfile.startDate?.trim()) {
      newErrors.startDate = "Start date is required";
    }
    if (!clientProfile.endDate?.trim()) {
      newErrors.endDate = "End date is required";
    }
    if (!clientProfile.recurrence?.trim()) {
      newErrors.recurrence = "Recurrence is required";
    }
    if (!clientProfile.phone?.trim()) {
      newErrors.phone = "Phone is required";
    }
    if (!clientProfile.gender?.trim()) {
      newErrors.gender = "Gender is required";
    }
    if (!clientProfile.ethnicity?.trim()) {
      newErrors.ethnicity = "Ethnicity is required";
    }
    if (!clientProfile.language?.trim()) {
      newErrors.language = "Language is required";
    }

    // Validate that the total number of household members is not zero
    if (clientProfile.adults === 0 && clientProfile.seniors === 0) {
      newErrors.total = "At least one adult or senior is required";
    }
    if (!/^\d{10}$/.test(clientProfile.phone || "")) {
      newErrors.phone = "Phone number must be exactly 10 digits";
    }
    if (clientProfile.alternativePhone && !/^\d{10}$/.test(clientProfile.alternativePhone)) {
      newErrors.alternativePhone = "Alternative Phone number must be exactly 10 digits";
    }

    // Validate referral entity if it exists
    if (clientProfile.referralEntity) {
      if (
        !clientProfile.referralEntity.id ||
        !clientProfile.referralEntity.name ||
        !clientProfile.referralEntity.organization
      ) {
        console.log("Debug: Incomplete referral entity data", clientProfile.referralEntity);
        // Don't block saving, but log it for debugging
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkIfNotesExists = (
    notes: string,
    prevNotesTimestamp: { notes: string; timestamp: Date } | null
  ) => {
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

      let updatedNotesTimestamp = checkIfNotesExists(
        currNotes,
        clientProfile.notesTimestamp || null
      );
      updatedNotesTimestamp = checkIfNotesChanged(prevNotes, currNotes, updatedNotesTimestamp);

      // Update the clientProfile object with the latest tags state
      const updatedProfile = {
        ...clientProfile,
        tags: tags, // Sync the tags state with clientProfile
        notesTimestamp: updatedNotesTimestamp, // Update the notesTimestamp
        updatedAt: new Date(),
        total: clientProfile.adults + clientProfile.children + clientProfile.seniors,
        ward: await getWard(clientProfile.address),
        // Explicitly include referral entity to ensure it's saved
        referralEntity: clientProfile.referralEntity,
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
        await setDoc(doc(db, "tags", "oGuiR2dQQeOBXHCkhDeX"), {
          tags: sortedAllTags,
        });
        setClientProfile(newProfile);
        setPrevClientProfile(null);
        setIsNewProfile(false);
        console.log("New profile created with ID: ", newUid);
        navigate(`/profile/${newUid}`);
      } else {
        // Update existing profile
        await setDoc(doc(db, "clients", clientProfile.uid), updatedProfile, {
          merge: true,
        });
        await setDoc(
          doc(db, "tags", "oGuiR2dQQeOBXHCkhDeX"),
          { tags: sortedAllTags },
          {
            merge: true,
          }
        );
        setPrevClientProfile(null);
        setClientProfile(updatedProfile);
      }

      // Make sure we update prevNotes with the current notes value to track changes properly
      setPrevNotes(currNotes);

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
    const value = fieldPath.includes(".")
      ? getNestedValue(clientProfile, fieldPath)
      : clientProfile[fieldPath as keyof ClientProfile];

    const isDisabledField = ["city", "state", "zipCode", "quadrant"].includes(fieldPath);

    const handleTag = (text: any) => {
      if (!prevTags) {
        setPrevTags(deepCopy(tags));
      }

      if (tags.includes(text)) {
        const updatedTags = tags.filter((t) => t !== text);
        setTags(updatedTags);
      } else if (text.trim() !== "") {
        const updatedTags = [...tags, text.trim()];
        setTags(updatedTags);
      }
    };

    return (
      <FormField
        fieldPath={fieldPath}
        value={value}
        type={type}
        isEditing={isEditing}
        handleChange={handleChange}
        getNestedValue={getNestedValue}
        handleDietaryRestrictionChange={handleDietaryRestrictionChange}
        addressInputRef={addressInputRef}
        isDisabledField={isDisabledField}
        ward={ward}
        tags={tags}
        allTags={allTags}
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        handleTag={handleTag}
      />
    );
  };

  // Updated handler for dietary restrictions
  const handleDietaryRestrictionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    handlePrevClientCopying();
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
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (isEditing) {
      // Check if the Google Maps API script is already loaded
      if (!window.google || !window.google.maps) {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY || ""}&libraries=places`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          initializeAutocomplete();
        };

        script.onerror = () => {
          console.error("Failed to load Google Maps API script.");
        };

        document.head.appendChild(script);
      } else {
        initializeAutocomplete();
      }
    }

    return () => {
      // Cleanup logic if needed
      autocompleteRef.current = null;
    };
  }, [isEditing]);

  const initializeAutocomplete = () => {
    if (addressInputRef.current && !autocompleteRef.current) {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        addressInputRef.current,
        {
          types: ["address"],
          componentRestrictions: { country: "us" },
        }
      );

      autocompleteRef.current?.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();
        if (place?.formatted_address) {
          const address = place.formatted_address;
          const addressComponents = place.address_components;

          let streetNumber = "";
          let streetName = "";
          let city = "";
          let state = "";
          let zipCode = "";
          let quadrant = "";

          if (addressComponents) {
            for (const component of addressComponents) {
              const types = component.types;

              if (types.includes("street_number")) {
                streetNumber = component.long_name;
              }

              if (types.includes("route")) {
                streetName = component.long_name;
              }

              if (types.includes("locality") || types.includes("sublocality")) {
                city = component.long_name;
              }

              if (types.includes("administrative_area_level_1")) {
                state = component.short_name;
              }

              if (types.includes("postal_code")) {
                zipCode = component.long_name;
              }
            }

            const quadrantMatch = address.match(/(NW|NE|SW|SE)(\s|,|$)/);
            if (state === "DC" && quadrantMatch) {
              quadrant = quadrantMatch[1];
            }

            setClientProfile((prev) => ({
              ...prev,
              address: `${streetNumber} ${streetName}`.trim(),
              city: city,
              state: state,
              zipCode: zipCode,
              quadrant: quadrant,
            }));
          }
        }
      });
    }
  };

  // Function to handle cancelling edits
  const handleCancel = () => {
    // If we have a previous state of the client profile, restore it
    if (prevClientProfile) {
      setClientProfile(prevClientProfile);
      setPrevClientProfile(null);
    }

    // If we have a previous state of tags, restore it
    if (prevTags) {
      setTags(prevTags);
      setPrevTags(null);
    }
  };

  // Function to handle selecting a case worker
  const handleCaseWorkerChange = (caseWorker: CaseWorker | null) => {
    setSelectedCaseWorker(caseWorker);

    // Update the client profile with the case worker information
    if (caseWorker) {
      setClientProfile((prev) => ({
        ...prev,
        referralEntity: {
          id: caseWorker.id,
          name: caseWorker.name,
          organization: caseWorker.organization,
        },
      }));
    } else {
      // If no case worker selected, remove the referral entity
      setClientProfile((prev) => {
        const newProfile = { ...prev };
        delete newProfile.referralEntity;
        return newProfile;
      });
    }
  };

  return (
    <Box className="profile-container">
      {showSavePopup && (
        <Box
          sx={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            backgroundColor: "#257e68",
            color: "white",
            padding: "16px",
            borderRadius: "4px",
            boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
            zIndex: 1000,
            animation: "slideIn 0.3s ease-out",
          }}
        >
          Profile saved successfully!
        </Box>
      )}

      {/* Profile Header */}
      <Box className="white-container">
        <Typography variant="h5" className="border-bottom" style={{ marginBottom: 20 }}>
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
          <PersonIcon style={{ marginRight: 3, color: "green" }} />
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
            <Typography
              className="basic-info-title"
              sx={{ fontWeight: 500, fontSize: { xs: "20px", sm: "24px" } }}
            >
              Basic Information
            </Typography>

            <Box display="flex" alignItems="center" gap={1} marginBottom={1}>
              <IconButton
                sx={{ color: "green" }}
                onClick={() => setIsEditing((prev) => !prev)}
                color={isEditing ? "secondary" : "primary"}
              >
                <Tooltip title={isEditing ? "Cancel Editing" : "Edit All"}>
                  {isEditing ? (
                    <span className="cancel-btn" onClick={handleCancel}>
                      <CloseIcon />
                    </span>
                  ) : (
                    <EditIcon />
                  )}
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

          {/* Basic Information Form */}
          <BasicInfoForm
            clientProfile={clientProfile}
            isEditing={isEditing}
            errors={errors}
            renderField={renderField}
            fieldLabelStyles={fieldLabelStyles}
          />

          {/* Delivery Information Form */}
          <DeliveryInfoForm
            clientProfile={clientProfile}
            isEditing={isEditing}
            renderField={renderField}
            fieldLabelStyles={fieldLabelStyles}
            lastDeliveryDate={lastDeliveryDate}
            selectedCaseWorker={selectedCaseWorker}
            caseWorkers={caseWorkers}
            setShowCaseWorkerModal={setShowCaseWorkerModal}
            handleCaseWorkerChange={handleCaseWorkerChange}
            isSaved={isSaved}
          />

          {/* Dietary Preferences Form */}
          <DietaryPreferencesForm
            isEditing={isEditing}
            renderField={renderField}
            fieldLabelStyles={fieldLabelStyles}
            dietaryRestrictions={clientProfile.deliveryDetails.dietaryRestrictions}
          />

          {/* Miscellaneous Form */}
          <MiscellaneousForm
            isEditing={isEditing}
            renderField={renderField}
            fieldLabelStyles={fieldLabelStyles}
            errors={errors}
          />
        </Box>
      </Box>

      {/* CaseWorkerManagementModal */}
      {showCaseWorkerModal && (
        <CaseWorkerManagementModal
          open={showCaseWorkerModal}
          onClose={() => setShowCaseWorkerModal(false)}
          caseWorkers={caseWorkers}
          onCaseWorkersChange={setCaseWorkers}
        />
      )}
    </Box>
  );
};

export default Profile;
