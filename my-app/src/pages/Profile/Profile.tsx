import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import {
  Autocomplete,
  Box,
  Button,
  IconButton,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Tooltip,
  Typography,
  styled,
} from "@mui/material";
import { FormControlLabel, Checkbox } from '@mui/material';
import {
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
  Timestamp,
  deleteDoc,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth, db } from "../../auth/firebaseConfig";
import CaseWorkerManagementModal from "../../components/CaseWorkerManagementModal";
import "./Profile.css";
import { ClientService, DeliveryService } from "../../services";
import PopUp from "../../components/PopUp";
import ErrorPopUp from "../../components/ErrorPopUp";

// Import new components from HEAD
import BasicInfoForm from "./components/BasicInfoForm";
import DeliveryInfoForm from "./components/DeliveryInfoForm";
import DietaryPreferencesForm from "./components/DietaryPreferencesForm";
import DeliveryLogForm from "./components/DeliveryLogForm";
import FormField from "./components/FormField";
import MiscellaneousForm from "./components/MiscellaneousForm";
import ProfileHeader from "./components/ProfileHeader";
// Keep Tags import from tags_update, remove TagPopup from HEAD
import TagManager from "./Tags/TagManager";
// import TagPopup from "./Tags/TagPopup"; <--- Removed

// Import types
import { CalendarConfig, CalendarEvent, CaseWorker, ClientProfile, NewDelivery, UserType } from "../../types";
import { ClientProfileKey, InputType } from "./types";
import { DeliveryEvent } from "../../types/calendar-types";
import { useAuth } from "../../auth/AuthProvider";
import { Add } from "@mui/icons-material";
import { Time, TimeUtils } from "../../utils/timeUtils";
import AddDeliveryDialog from "../Calendar/components/AddDeliveryDialog";
import { calculateRecurrenceDates } from "../Calendar/components/CalendarUtils";
import { DayPilot } from "@daypilot/daypilot-lite-react";
import { toJSDate } from '../../utils/timestamp';

// Styling
const fieldStyles = {
  backgroundColor: "white",
  width: "60%",
  height: "56px",
  padding: "0.1rem 0.5rem",
  borderRadius: "5px",
  border: ".1rem solid black",
  marginTop: "0px",
};

// Simple dropdown styling - use native MUI arrow positioned inside field
const simpleDropdownStyles = {
  backgroundColor: "white",
  width: "100%",
  height: "56px",
  borderRadius: "5px",
  border: ".1rem solid black",
  marginTop: "0px",
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    border: "2px solid #257E68",
    boxShadow: "0 0 8px rgba(37, 126, 104, 0.4), 0 0 16px rgba(37, 126, 104, 0.2)",
  },
  '& .MuiOutlinedInput-notchedOutline': {
    display: 'none', // Remove MUI border
  },
  '& .MuiSelect-select': {
    padding: '0 48px 0 14px', // Increased right padding to 48px to avoid arrow overlap
    display: 'flex',
    alignItems: 'center',
  },
  '& .MuiSelect-icon': {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#666',
    fontSize: '1.2rem',
  },
};

// Enhanced styling for text fields
const CustomTextField = styled(TextField)({
  "& .MuiOutlinedInput-root": {
    "& fieldset": {
      border: "none",
    },
    "&:hover fieldset": {
      borderColor: "var(--color-primary)",
    },    "&.Mui-focused fieldset": {
      borderColor: "#257E68",
      border: "2px solid #257E68",
    },
  },
  "& .MuiInputBase-input": {
    ...fieldStyles,
    transition: "all 0.3s ease",    "&:focus": {
      border: "2px solid #257E68",
      outline: "none",
      boxShadow: "0 0 8px rgba(37, 126, 104, 0.4), 0 0 16px rgba(37, 126, 104, 0.2)",
    },
  },
});

// Styled components for common elements
const SectionBox = styled(Box)(({ theme }) => ({
  backgroundColor: "white",
  borderRadius: "8px",
  padding: "20px",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
  marginBottom: "20px",
  transition: "all 0.3s ease",
  "&:hover": {
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  fontSize: "1.25rem",
  marginBottom: "16px",
  position: "relative",
  paddingBottom: "8px",
  "&:after": {
    content: '""',
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "40px",
    height: "3px",
    backgroundColor: "var(--color-primary)",
    borderRadius: "2px",
  },
}));

const StyledIconButton = styled(IconButton)({
  backgroundColor: "rgba(37, 126, 104, 0.08)",
  color: "var(--color-primary)",
  transition: "all 0.2s ease",
  "&:hover": {
    backgroundColor: "rgba(37, 126, 104, 0.15)",
    transform: "translateY(-2px)",
  },
});

// Toast notification component for save confirmation
const SaveNotification = styled(Box)({
  position: "fixed",
  bottom: "20px",
  right: "20px",
  backgroundColor: "var(--color-primary)",
  color: "white",
  padding: "16px 24px",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
  zIndex: 1000,
  animation: "slideInAndFade 0.3s ease-out",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  "@keyframes slideInAndFade": {
    "0%": {
      transform: "translateY(20px)",
      opacity: 0,
    },
    "100%": {
      transform: "translateY(0)",
      opacity: 1,
    },
  },
});

// Type definitions have been moved to types directory
const Profile = () => {
  // #### PARAMS and NAVIGATION ####
  const navigate = useNavigate();
  const params = useParams();
  const clientIdParam: string | null = params.clientId ?? null;
  const { userRole } = useAuth();

  // #### STATE ####
  const [isEditing, setIsEditing] = useState(!clientIdParam);
  const [isNewProfile, setIsNewProfile] = useState(!clientIdParam);
  const [clientId, setClientId] = useState<string | null>(clientIdParam);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState<boolean>(false);
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
        heartFriendly: false,
        foodAllergens: [],
        otherText: "",
        other: false,     // Changed from string to boolean

      },
    },
    lifeChallenges: "",
    notes: "",
    notesTimestamp: null,
    deliveryInstructionsTimestamp: null, // New timestamp field for delivery instructions
    lifeChallengesTimestamp: null,       // New timestamp field for life challenges
    lifestyleGoalsTimestamp: null,
    lifestyleGoals: "",
    language: "",
    createdAt: TimeUtils.now().toJSDate(),
    updatedAt: TimeUtils.now().toJSDate(),
    startDate: "",
    endDate: "",
    recurrence: "None",
    tags: [],
    ward: "",
    tefapCert: "",
    referralEntity: null,
    coordinates: []
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [fieldEditStates, setFieldEditStates] = useState<{ [key: string]: boolean }>({});
  const [formData, setFormData] = useState({});
  const [isSaved, setIsSaved] = useState(false);
  const [ward, setWard] = useState(clientProfile.ward);
  const [lastDeliveryDate, setLastDeliveryDate] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [prevNotes, setPrevNotes] = useState("");
  const [showSavePopup, setShowSavePopup] = useState(false);
  const [showCaseWorkerModal, setShowCaseWorkerModal] = useState(false);
  const [caseWorkers, setCaseWorkers] = useState<CaseWorker[]>([]);
  const [selectedCaseWorker, setSelectedCaseWorker] = useState<CaseWorker | null>(null);
  const [pastDeliveries, setPastDeliveries] = useState<DeliveryEvent[]>([]);
  const [futureDeliveries, setFutureDeliveries] = useState<DeliveryEvent[]>([]);
  const [events, setEvents] = useState<DeliveryEvent[]>([]);

  // Add clients state for fetchClients()
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [addressError, setAddressError] = useState<string>("");
  const [userTypedAddress, setUserTypedAddress] = useState<string>("");
  const [isAddressValidated, setIsAddressValidated] = useState<boolean>(true);
  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);
  const [duplicateErrorMessage, setDuplicateErrorMessage] = useState("A client with this name and address already exists in the system.");
  const [showSimilarNamesInfo, setShowSimilarNamesInfo] = useState(false);
  const [similarNamesMessage, setSimilarNamesMessage] = useState("");

  
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
    if (clientIdParam) {
      setIsNewProfile(false);
      setClientId(clientIdParam);
      getProfileById(clientIdParam).then((profileData) => {
        if (profileData) {
          setTags(profileData.tags?.filter((tag) => allTags.includes(tag)) || []);
          setClientProfile(profileData);

          // Set prevNotes only when the profile is loaded from Firebase
          if (!profileLoaded) {
            setPrevNotes(profileData.notes || "");
            setProfileLoaded(true);
          }
        } else {
          console.log("No profile found for ID:", clientIdParam);
        }
      });
    } else {
      setIsNewProfile(true);
      setClientProfile({
        ...clientProfile,
        createdAt: TimeUtils.now().toJSDate(),
        updatedAt: TimeUtils.now().toJSDate(),
        referralEntity: null,
      });
      setTags([]);
      setSelectedCaseWorker(null);
      setProfileLoaded(false);
      setPrevNotes("");
    }
  }, [clientIdParam, allTags, profileLoaded]);

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
            const deliveryDate = Time.Firebase.fromTimestamp(lastEvent.deliveryDate);
            setLastDeliveryDate(deliveryDate.toISODate() || "");
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

  useEffect(() => {
    const fetchDeliveryHistory = async () => {
      const deliveryService = DeliveryService.getInstance();
      try {
        const { pastDeliveries, futureDeliveries } = await deliveryService.getClientDeliveryHistory(clientId!);
        setPastDeliveries(pastDeliveries);
        setFutureDeliveries(futureDeliveries);
      } catch (error) {
        console.error("Failed to fetch delivery history", error);
      }
    };
    console.log('ran')
    fetchDeliveryHistory();
  }, [clientId, isDeliveryModalOpen]);

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
          wardName = "No ward";
        }
      } else {
        console.log("No address found or invalid response.");
        wardName = "No address";
      }
    } catch (error) {
      console.error("Error fetching ward information:", error);
      wardName = "Error";
    }
    clientProfile.ward = wardName;
    setWard(wardName);
    return wardName;
  };

  const getCoordinates = async (address: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('https://geocode-addresses-endpoint-lzrplp4tfa-uc.a.run.app', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addresses: [address]
        }),
      });

      //API returns {[coordinates[]]} so destructure and return index 0
      if (response.ok) {
        const { coordinates } = await response.json();
        return coordinates[0];
      }
    }
    catch (error) {
      //[0,0] is an invalid coordinate handled in DelivertSpreadsheet.tsx
      console.error(error)
      return [0, 0];
    }
  }

  // Update the toggleFieldEdit function to be type-safe
  const toggleFieldEdit = (fieldName: ClientProfileKey) => {
    setFieldEditStates((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
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
  
    // Special handling for address field to avoid conflicts with Google Places
    if (name === "address") {
      // Clear address error when user manually changes address
      if (addressError) {
        setAddressError("");
        setIsAddressValidated(true);
      }
    }
  
    if (name === "dob" || name === "tefapCert") {
      const date = e.target.value; // this will be in the format YYYY-MM-DD
      setClientProfile((prevState) => ({
        ...prevState,
        [name]: date,
      }));
    } else if (name === "adults" || name === "children" || name === "seniors") {
      if (Number(value) < 0) {
        return; //do nothing if the input is negative
      }
      setClientProfile((prevState) => ({
        ...prevState,
        [name]: Number(value),
      }));    } else if (name === "phone" || name === "alternativePhone") {
      setClientProfile((prevState) => {
        const updatedProfile = {
          ...prevState,
          [name]: value,
        };
        
        // Validate phone numbers on change
        const countDigits = (str: string) => (str.match(/\d/g) || []).length;
        const isValidPhoneFormat = (phone: string) => {
          // Allowed formats: (123) 456-7890, 123-456-7890, 123.456.7890, 123 456 7890, 1234567890, +1 123-456-7890
          return /^(\+\d{1,2}\s?)?((\(\d{3}\))|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}$/.test(phone);
        };
        const newErrors = { ...errors };
        
        if (name === "phone") {
          if (value.trim() === "") {
            newErrors.phone = "Phone is required";
          } else if (countDigits(value) < 10) {
            newErrors.phone = "Phone number must contain at least 10 digits";          } else if (!isValidPhoneFormat(value)) {
            newErrors.phone = `"${value}" is an invalid format. Please see the i icon for allowed formats.`;
          } else {
            delete newErrors.phone;
          }
        }
          if (name === "alternativePhone") {
          if (value.trim() !== "" && (countDigits(value) < 10 || !isValidPhoneFormat(value))) {
            newErrors.alternativePhone = `"${value}" is an invalid format. Please see the i icon for allowed formats.`;
          } else {
            delete newErrors.alternativePhone;
          }
        }
        
        setErrors(newErrors);
        return updatedProfile;
      });
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

  // validate profile function, returns error message
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
    if (clientProfile.email?.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientProfile.email.trim())
    ) {
      newErrors.email = "Invalid email format";
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
    }    // Validate that the total number of household members is not zero
    if (clientProfile.adults === 0 && clientProfile.seniors === 0) {
      newErrors.total = "At least one adult or senior is required";
    }
    
    // Count digits and validate phone number format
    const countDigits = (str: string) => (str.match(/\d/g) || []).length;
    const isValidPhoneFormat = (phone: string) => {
      // Allowed formats: (123) 456-7890, 123-456-7890, 123.456.7890, 123 456 7890, 1234567890, +1 123-456-7890
      return /^(\+\d{1,2}\s?)?((\(\d{3}\))|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}$/.test(phone);
    };
    
    if (!clientProfile.phone?.trim()) {
      newErrors.phone = "Phone is required";
    } else if (countDigits(clientProfile.phone) < 10) {
      newErrors.phone = "Phone number must contain at least 10 digits";    } else if (!isValidPhoneFormat(clientProfile.phone)) {
      newErrors.phone = `"${clientProfile.phone}" is an invalid format. Please see the i icon for allowed formats.`;
    }
      if (clientProfile.alternativePhone?.trim() && 
        (countDigits(clientProfile.alternativePhone) < 10 || !isValidPhoneFormat(clientProfile.alternativePhone))) {
      newErrors.alternativePhone = `"${clientProfile.alternativePhone}" is an invalid format. Please see the i icon for allowed formats.`;
    }

    //validate head of household logic
    if ((clientProfile.headOfHousehold === "Senior" && clientProfile.seniors == 0) || (clientProfile.headOfHousehold === "Adult" && clientProfile.adults == 0)){
      newErrors.headOfHousehold = `Head of household is ${clientProfile.headOfHousehold} but no ${clientProfile.headOfHousehold} listed`;
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

    // returns newErrors object
    return newErrors;

  };

  const checkIfNotesExists = (
    notes: string,
    prevNotesTimestamp: { notes: string; timestamp: Date } | null
  ) => {
    if (!prevNotesTimestamp && notes.trim() !== "") {
      return { notes, timestamp: TimeUtils.now().toJSDate() };
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
      return { notes: newNotes, timestamp: TimeUtils.now().toJSDate() };
    }
    return prevNotesTimestamp;
  };

// Function to normalize text fields for database storage
// This ensures consistent storage format for case-insensitive comparisons
const normalizeTextFields = (profile: ClientProfile): ClientProfile => {
  // Create a deep copy to avoid modifying the original
  const normalized = {
    ...profile,
    // Key fields for duplicate prevention - use lowercase for name fields
    firstName: (profile.firstName || "").trim().toLowerCase(),
    lastName: (profile.lastName || "").trim().toLowerCase(),
    // Don't lowercase addresses, but trim them
    address: (profile.address || "").trim(),
    address2: (profile.address2 || "").trim(),
    zipCode: (profile.zipCode || "").trim(),
    city: (profile.city || "").trim(),
    state: (profile.state || "").trim(),
    email: (profile.email || "").trim().toLowerCase(),
  };
  return normalized;
};

// Function to check for duplicate client and return useful information
// Return type for the enhanced duplicate check
interface DuplicateCheckResult {
  isDuplicate: boolean;
  sameNameCount?: number;
  sameNameDiffAddressCount?: number;
}

const checkDuplicateClient = async (firstName: string, lastName: string, address: string, zipCode: string, excludeUid?: string): Promise<boolean | DuplicateCheckResult> => {
  // Normalize inputs for comparison only
  const normalizeString = (str: string) => (str || '').trim().toLowerCase();
  const normalizedFirstName = normalizeString(firstName);
  const normalizedLastName = normalizeString(lastName);
  const normalizedAddress = normalizeString(address);
  const normalizedZipCode = normalizeString(zipCode);

  // Skip check if any required field is empty
  if (!normalizedFirstName || !normalizedLastName || !normalizedAddress || !normalizedZipCode) {
    return false;
  }

  // Query Firestore for all clients with the same address and zip code
  const clientService = ClientService.getInstance();
  const db = clientService["db"];
  const clientsCollection = clientService["clientsCollection"];
  const addressZipQuery = query(
    collection(db, clientsCollection),
    where("address", "==", address),
    where("zipCode", "==", zipCode)
  );
  const addressZipSnapshot = await getDocs(addressZipQuery);

  // Filter for same name (case-insensitive)
  const sameNameClients = addressZipSnapshot.docs.filter(docSnap => {
    const data = docSnap.data();
    return (
      normalizeString(data.firstName) === normalizedFirstName &&
      normalizeString(data.lastName) === normalizedLastName &&
      (!excludeUid || data.uid !== excludeUid)
    );
  });

  const sameNameClientsCount = sameNameClients.length;
  const duplicateFound = sameNameClientsCount > 0;

  // For similar name warning: query by zip only, then filter for same name but different address
  let sameNameDiffAddressCount = 0;
  if (!duplicateFound) {
    const zipQuery = query(
      collection(db, clientsCollection),
      where("zipCode", "==", zipCode)
    );
    const zipSnapshot = await getDocs(zipQuery);
    sameNameDiffAddressCount = zipSnapshot.docs.filter(docSnap => {
      const data = docSnap.data();
      return (
        normalizeString(data.firstName) === normalizedFirstName &&
        normalizeString(data.lastName) === normalizedLastName &&
        normalizeString(data.address) !== normalizedAddress &&
        (!excludeUid || data.uid !== excludeUid)
      );
    }).length;
  }

  if (duplicateFound) {
    return {
      isDuplicate: true,
      sameNameCount: sameNameClientsCount,
      sameNameDiffAddressCount
    };
  }

  if (sameNameDiffAddressCount > 0) {
    return {
      isDuplicate: false,
      sameNameCount: 0,
      sameNameDiffAddressCount
    };
  }

  return false;
};

  const handleSave = async () => {
    // Important: First validate basic requirements
    const validation = validateProfile();
  
    // Check for address validation error
    if (addressError) {
      alert("Please fix the address error before saving. Make sure to select a valid address from the Google Places suggestions.");
      return;
    }
  
    if (Object.keys(validation).length > 0) {
      const errorFields = Object.entries(validation)
        .map(([field, message]) => `- ${message}`)
        .join('\n');
      alert(`Please fix the following before saving:\n${errorFields}`);
      return;
    }
    
    // Clear any previous duplicate popup states
    setShowDuplicatePopup(false);
  
    // Show saving indicator? (Optional)
    // setIsLoading(true);
  
    try {
      if (isNewProfile) {
        // Force duplicate check to always happen with direct values, not through variables
        const duplicateResult = await checkDuplicateClient(
          String(clientProfile.firstName).trim(),
          String(clientProfile.lastName).trim(),
          String(clientProfile.address).trim(),
          String(clientProfile.zipCode).trim()
        );
        
        let isDuplicate = false;
        let sameNameCount = 0;
        let sameNameDiffAddressCount = 0;
        
        // Handle different result formats
        if (typeof duplicateResult === 'boolean') {
          isDuplicate = duplicateResult;
        } else {
          isDuplicate = duplicateResult.isDuplicate;
          sameNameCount = duplicateResult.sameNameCount || 0;
          sameNameDiffAddressCount = duplicateResult.sameNameDiffAddressCount || 0;
        }
        
        if (isDuplicate) {
          // Create a detailed error message including exact fields that caused the duplicate
          const errorMsg = `DUPLICATE CLIENT DETECTED\n\nA client with the following details already exists in the system:\n\nName: ${clientProfile.firstName} ${clientProfile.lastName}\nAddress: ${clientProfile.address}\nZIP Code: ${clientProfile.zipCode}\n\nYou cannot save this client because it would create a duplicate record.\nPlease check if this is truly a new client with a unique name or address.`;
          // Update error message and show the popup
          setDuplicateErrorMessage(errorMsg);
          setShowDuplicatePopup(true);
          // No automatic timeout - let the user dismiss the error
          return;
        }
        
        // Warn if there are other clients with the same name in the same zip code
        if (sameNameDiffAddressCount > 0) {
          const warningMsg = `Note: There ${sameNameDiffAddressCount === 1 ? 'is' : 'are'} ${sameNameDiffAddressCount} other client${sameNameDiffAddressCount === 1 ? '' : 's'} with the name "${clientProfile.firstName} ${clientProfile.lastName}" in ZIP code "${clientProfile.zipCode}", but at different addresses.`;
          setSimilarNamesMessage(warningMsg);
          setShowSimilarNamesInfo(true);
        }
      } else {
        // Force duplicate check to always happen with direct values, not through variables
        const duplicateResult = await checkDuplicateClient(
          String(clientProfile.firstName).trim(),
          String(clientProfile.lastName).trim(),
          String(clientProfile.address).trim(),
          String(clientProfile.zipCode).trim(),
          String(clientProfile.uid)
        );
        
        let isDuplicate = false;
        let sameNameCount = 0;
        let sameNameDiffAddressCount = 0;
        
        // Handle different result formats
        if (typeof duplicateResult === 'boolean') {
          isDuplicate = duplicateResult;
        } else {
          isDuplicate = duplicateResult.isDuplicate;
          sameNameCount = duplicateResult.sameNameCount || 0;
          sameNameDiffAddressCount = duplicateResult.sameNameDiffAddressCount || 0;
        }
        
        if (isDuplicate) {
          // Create a detailed error message including exact fields that caused the duplicate
          const errorMsg = `DUPLICATE CLIENT DETECTED\n\nA client with the following details already exists in the system:\n\nName: ${clientProfile.firstName} ${clientProfile.lastName}\nAddress: ${clientProfile.address}\nZIP Code: ${clientProfile.zipCode}\n\nYou cannot save this client because it would create a duplicate record.\nPlease check if this is truly a different client with a unique name or address.`;
          // Update error message and show the popup
          setDuplicateErrorMessage(errorMsg);
          setShowDuplicatePopup(true);
          // No automatic timeout - let the user dismiss the error
          return;
        }
        
        // Warn if there are other clients with the same name in the same zip code
        if (sameNameDiffAddressCount > 0) {
          const warningMsg = `Note: There ${sameNameDiffAddressCount === 1 ? 'is' : 'are'} ${sameNameDiffAddressCount} other client${sameNameDiffAddressCount === 1 ? '' : 's'} with the name "${clientProfile.firstName} ${clientProfile.lastName}" in ZIP code "${clientProfile.zipCode}", but at different addresses.`;
          setSimilarNamesMessage(warningMsg);
          setShowSimilarNamesInfo(true);
        }
      }
      // --- Geocoding Optimization Start ---
      let addressChanged = false;
      if (isNewProfile || !prevClientProfile) {
        // Always geocode for new profiles or if previous state is missing
        addressChanged = true;
      } else {
        // Check if any address component changed
        if (
          clientProfile.address !== prevClientProfile.address ||
          clientProfile.city !== prevClientProfile.city ||
          clientProfile.state !== prevClientProfile.state ||
          clientProfile.zipCode !== prevClientProfile.zipCode
        ) {
          addressChanged = true;
        }
      }
  
      // Also force geocode if coordinates are missing or invalid
      if (!addressChanged && (!clientProfile.coordinates || clientProfile.coordinates.length === 0 || (clientProfile.coordinates[0].lat === 0 && clientProfile.coordinates[0].lng === 0))) {
          addressChanged = true;
      }
  
      let fetchedWard = clientProfile.ward; // Default to existing ward
      let coordinatesToSave = clientProfile.coordinates; // Default to existing coordinates
  
      if (addressChanged) {
        fetchedWard = await getWard(clientProfile.address); // Fetch ward only if address changed
        coordinatesToSave = await getCoordinates(clientProfile.address); // Fetch coordinates only if address changed
      }
      // --- Geocoding Optimization End ---
  
      const currentNotes = clientProfile.notes || ""; // Ensure notes is a string
      let updatedNotesTimestamp = checkIfNotesExists(
        currentNotes,
        clientProfile.notesTimestamp || null
      );
      updatedNotesTimestamp = checkIfNotesChanged(
        prevNotes, // Compare against the notes content *before* this edit session
        currentNotes,
        updatedNotesTimestamp
      );
  
      // Delivery Instructions Timestamp
      const prevDeliveryInstructions = prevClientProfile?.deliveryDetails.deliveryInstructions || "";
      const currentDeliveryInstructions = clientProfile.deliveryDetails.deliveryInstructions || "";
      let updatedDeliveryInstructionsTimestamp = checkIfNotesExists(
        currentDeliveryInstructions,
        clientProfile.deliveryInstructionsTimestamp || null
      );
      updatedDeliveryInstructionsTimestamp = checkIfNotesChanged(
        prevDeliveryInstructions,
        currentDeliveryInstructions,
        updatedDeliveryInstructionsTimestamp
      );
  
      // Life Challenges Timestamp
      const prevLifeChallenges = prevClientProfile?.lifeChallenges || "";
      const currentLifeChallenges = clientProfile.lifeChallenges || "";
      let updatedLifeChallengesTimestamp = checkIfNotesExists(
        currentLifeChallenges,
        clientProfile.lifeChallengesTimestamp || null
      );
      updatedLifeChallengesTimestamp = checkIfNotesChanged(
        prevLifeChallenges,
        currentLifeChallenges,
        updatedLifeChallengesTimestamp
      );
  
      // Lifestyle Goals Timestamp
      const prevLifestyleGoals = prevClientProfile?.lifestyleGoals || "";
      const currentLifestyleGoals = clientProfile.lifestyleGoals || "";
      let updatedLifestyleGoalsTimestamp = checkIfNotesExists(
        currentLifestyleGoals,
        clientProfile.lifestyleGoalsTimestamp || null
      );
      updatedLifestyleGoalsTimestamp = checkIfNotesChanged(
        prevLifestyleGoals,
        currentLifestyleGoals,
        updatedLifestyleGoalsTimestamp
      );
  
      // Update the clientProfile object with the latest tags state and other calculated fields
      const updatedProfile: ClientProfile = {
        ...clientProfile,
        tags: tags, // Sync the tags state with clientProfile
        notesTimestamp: updatedNotesTimestamp, // Update the notesTimestamp
        deliveryInstructionsTimestamp: updatedDeliveryInstructionsTimestamp,
        lifeChallengesTimestamp: updatedLifeChallengesTimestamp,
        lifestyleGoalsTimestamp: updatedLifestyleGoalsTimestamp,
        updatedAt: TimeUtils.now().toJSDate(),
        total: Number(clientProfile.adults || 0) + Number(clientProfile.children || 0) + Number(clientProfile.seniors || 0),
        ward: fetchedWard, // Use potentially updated ward
        coordinates: coordinatesToSave, // Use potentially updated coordinates
        // Ensure referralEntity is included based on selectedCaseWorker
        referralEntity: selectedCaseWorker
          ? { id: selectedCaseWorker.id, name: selectedCaseWorker.name, organization: selectedCaseWorker.organization }
          : null, // Use null if no case worker is selected
      };
  
      // Sort allTags before potentially saving them (ensures consistent order)
      // Combine current tags and all known tags, remove duplicates, then sort
      const combinedTags = Array.from(new Set([...allTags, ...tags])); // Use Array.from for compatibility
      const sortedAllTags = combinedTags.sort((a, b) => a.localeCompare(b));
  
      if (isNewProfile) {
        // Generate new UID for new profile
        const newUid = await generateUID();
        // Save to Firestore for new profile (DO NOT normalize fields for saving)
        const newProfile = {
          ...updatedProfile,
          uid: newUid,
          createdAt: TimeUtils.now().toJSDate(), // Set createdAt for new profile
        };
        // Save to Firestore for new profile
        console.log("Creating new profile:", newProfile);
        await setDoc(doc(db, "clients", newUid), newProfile);
        // Update the central tags list
        await setDoc(doc(db, "tags", "oGuiR2dQQeOBXHCkhDeX"), { tags: sortedAllTags }, { merge: true });
        // Update state *before* navigating
        setClientProfile(newProfile); // Update with the full new profile data including UID/createdAt
        setPrevClientProfile(null); // Clear previous state backup
        setPrevNotes(newProfile.notes || ""); // Update prevNotes with saved notes
        setIsNewProfile(false); // No longer a new profile
        setClientId(newUid);    // Set the clientId state for the current view
        setIsSaved(true);       // Indicate save was successful
        setErrors({});          // Clear validation errors
        setAllTags(sortedAllTags); // Update the local list of all tags
        console.log("New profile created with ID: ", newUid);
        // Navigate *after* state updates. The component will remount with isEditing=false.
        navigate(`/profile/${newUid}`);
      } else {
        // Update existing profile
        if (!clientProfile.uid) {
          console.error("Cannot update profile: UID is missing.");
          alert("Error: Cannot update profile, client ID is missing.");
          throw new Error("Client UID is missing for update.");
        }
        // Save to Firestore for existing profile (DO NOT normalize fields for saving)
        console.log("Updating profile:", clientProfile.uid, updatedProfile);
        await setDoc(doc(db, "clients", clientProfile.uid), updatedProfile, { merge: true }); // Use merge: true for updates
        // Update the central tags list
        await setDoc(doc(db, "tags", "oGuiR2dQQeOBXHCkhDeX"), { tags: sortedAllTags }, { merge: true });
        // Update state *after* successful save for existing profile
        setClientProfile(updatedProfile); // Update with latest data
        setPrevClientProfile(null); // Clear previous state backup
        setPrevNotes(updatedProfile.notes || ""); // Update prevNotes
        setIsSaved(true); // Indicate save was successful
        setIsEditing(false); // <<<<<< EXIT EDIT MODE HERE for existing profiles
        setErrors({}); // Clear validation errors
        setAllTags(sortedAllTags); // Update the local list of all tags
        console.log("Profile updated:", clientProfile.uid);
      }
  
      // Common post-save actions (Popup notification)
      // setEditMode(false); <-- Removed redundant call
      setShowSavePopup(true);
      setTimeout(() => setShowSavePopup(false), 2000);
  
    } catch (e) {
      console.error("Error saving document: ", e);
      alert(`Failed to save profile: ${e instanceof Error ? e.message : String(e)}`);
      // Consider keeping isEditing true or providing more feedback
    } finally {
      // Hide saving indicator? (Optional)
      // setIsLoading(false);
    }
  };

  // Updated field label styles for a more modern look
  const fieldLabelStyles = {
    fontWeight: 600,
    marginBottom: !isEditing ? "12px" : "8px",
    textAlign: "left",
    fontSize: {
      xs: "14px",
      md: "13px",
      lg: "14px",
    },
    color: "var(--color-text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    position: "relative",
    paddingLeft: "8px",
    "&:before": {
      content: '""',
      position: "absolute",
      left: 0,
      top: "50%",
      transform: "translateY(-50%)",
      width: "3px",
      height: "14px",
      backgroundColor: "var(--color-primary)",
      borderRadius: "2px",
    },
  };

  // Helper function to get nested values
  const getNestedValue = (obj: any, path: string) => {
    return path.split(".").reduce((acc, part) => acc?.[part], obj);
  };

  // Re-define renderField based on its likely structure before deletion in HEAD
  const renderField = (fieldPath: ClientProfileKey, type: InputType = "text") => {
    if (type === "dietaryRestrictions") {
      const dietaryOptions = [
        { name: "lowSugar", label: "Low Sugar" },
        { name: "kidneyFriendly", label: "Kidney Friendly" },
        { name: "vegan", label: "Vegan" },
        { name: "vegetarian", label: "Vegetarian" },
        { name: "halal", label: "Halal" },
        { name: "microwaveOnly", label: "Microwave Only" },
        { name: "softFood", label: "Soft Food" },
        { name: "lowSodium", label: "Low Sodium" },
        { name: "noCookingEquipment", label: "No Cooking Equipment" },
        { name: "heartFriendly", label: "Heart Friendly" }
      ] as const;

      interface DietaryOption {
        name: 'lowSugar' | 'kidneyFriendly' | 'vegan' | 'vegetarian' | 'halal' |
        'microwaveOnly' | 'softFood' | 'lowSodium' | 'noCookingEquipment' | 'heartFriendly';
        label: string;
      }

      interface DietaryRestrictions {
        lowSugar: boolean;
        kidneyFriendly: boolean;
        vegan: boolean;
        vegetarian: boolean;
        halal: boolean;
        microwaveOnly: boolean;
        softFood: boolean;
        lowSodium: boolean;
        noCookingEquipment: boolean;
        heartFriendly: boolean;
        other: boolean;
        otherText: string;
      }

      return (
        <>

{dietaryOptions.map((option: DietaryOption) => (
  <FormControlLabel
    key={option.name}
    control={      <Checkbox
        checked={Boolean(clientProfile.deliveryDetails?.dietaryRestrictions?.[option.name])}
        onChange={handleDietaryRestrictionChange}
        name={option.name}
        sx={{
          "&:focus": {
            outline: "none",
          },
          "&.Mui-focusVisible": {
            outline: "none",
            "& .MuiSvgIcon-root": {
              color: "#257E68",
              filter: "drop-shadow(0 0 8px rgba(37, 126, 104, 0.4)) drop-shadow(0 0 16px rgba(37, 126, 104, 0.2))",
            },
          },
          "& input:focus + .MuiSvgIcon-root": {
            color: "#257E68",
            filter: "drop-shadow(0 0 8px rgba(37, 126, 104, 0.4)) drop-shadow(0 0 16px rgba(37, 126, 104, 0.2))",
          },
        }}
      />
    }
    label={option.label}
  />
))}

<Box sx={{ 
  display: 'flex', 
  alignItems: 'center',
  gap: 1,
  width: '100%',
}}>
  <FormControlLabel
    control={      <Checkbox
        checked={clientProfile.deliveryDetails?.dietaryRestrictions?.other || false}
        onChange={handleDietaryRestrictionChange}
        name="other"
        sx={{
          "&:focus": {
            outline: "none",
          },
          "&.Mui-focusVisible": {
            outline: "none",
            "& .MuiSvgIcon-root": {
              color: "#257E68",
              filter: "drop-shadow(0 0 8px rgba(37, 126, 104, 0.4)) drop-shadow(0 0 16px rgba(37, 126, 104, 0.2))",
            },
          },
          "& input:focus + .MuiSvgIcon-root": {
            color: "#257E68",
            filter: "drop-shadow(0 0 8px rgba(37, 126, 104, 0.4)) drop-shadow(0 0 16px rgba(37, 126, 104, 0.2))",
          },
        }}
      />
    }
    label="Other"
  />
  {clientProfile.deliveryDetails?.dietaryRestrictions?.other && (    <TextField
      name="otherText"
      value={clientProfile.deliveryDetails?.dietaryRestrictions?.otherText || ""}
      onChange={handleDietaryRestrictionChange}
      placeholder="Please specify other dietary restrictions"
      variant="outlined"
      size="small"
      sx={{ 
        flexGrow: 1, 
        marginTop: '5%',        '& .MuiOutlinedInput-root': {
          '&.Mui-focused fieldset': {
            borderColor: "#257E68",
            border: "2px solid #257E68",
            boxShadow: "0 0 8px rgba(37, 126, 104, 0.4), 0 0 16px rgba(37, 126, 104, 0.2)",
          },
        },
      }}
    />
  )}
</Box>
        </>
      );
    }

    if (fieldPath === "language") {
      if (!isEditing) {
        return <Box>{clientProfile.language}</Box>;
      }

      const preDefinedOptions = ["English", "Spanish"];
      // If the stored language is not one of the predefined ones, we default to "Other"
      const isPredefined = preDefinedOptions.includes(clientProfile.language);
      const selectValue = isPredefined ? clientProfile.language : "Other";

      const handleLanguageSelectChange = (e: any) => {
        const newVal = e.target.value;
        if (newVal !== "Other") {
          // Update with selected value
          handleChange({ target: { name: "language", value: newVal } } as any);
        } else {
          // Clear the language to allow custom entry
          handleChange({ target: { name: "language", value: "" } } as any);
        }
      };

      const handleCustomLanguageChange = (e: any) => {
        handleChange(e);
      };
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Select
            name="language"
            value={selectValue}
            onChange={handleLanguageSelectChange}
            sx={simpleDropdownStyles}
          >
            {preDefinedOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
            <MenuItem value="Other">Other</MenuItem>
          </Select>
          {selectValue === "Other" && (            <TextField
              name="language"              placeholder="Enter language"
              value={isPredefined ? "" : clientProfile.language}
              onChange={handleCustomLanguageChange}
              sx={{
                backgroundColor: "white",
                width: "100%",
                height: "56px",
                padding: "0.1rem 0.5rem",
                borderRadius: "5px",
                marginTop: "0px",
                '& .MuiOutlinedInput-root': {
                  '&.Mui-focused fieldset': {
                    border: "2px solid #257E68",
                    boxShadow: "0 0 8px rgba(37, 126, 104, 0.4), 0 0 16px rgba(37, 126, 104, 0.2)",
                  },
                },
              }}
            />
          )}
        </Box>
      );
    }

    if (fieldPath === "ethnicity") {
      if (!isEditing) {
        return <Box>{clientProfile.ethnicity}</Box>;
      }

      const preDefinedOptions = [
        "White",
        "Asian",
        "Hispanic, Latino, or Spanish",
        "Black or African American",
        "American Indian or Alaska Native",
        "Middle Eastern or North African",
        "Native Hawaiian or Pacific Islander",
        "Prefer Not to Say"
      ];

      const isPredefined = preDefinedOptions.includes(clientProfile.ethnicity);
      const selectValue = isPredefined ? clientProfile.ethnicity : "Other";

      const handleEthnicitySelectChange = (e: any) => {
        const newVal = e.target.value;
        if (newVal !== "Other") {
          // Update with selected value
          handleChange({ target: { name: "ethnicity", value: newVal } } as any);
        } else {
          // Clear the ethnicity to allow custom entry
          handleChange({ target: { name: "ethnicity", value: "" } } as any);
        }
      };

      const handleEthnicityCustomChange = (e: any) => {
        handleChange(e);
      };

      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Select
            name="ethnicity"
            value={selectValue}
            onChange={handleEthnicitySelectChange}
            sx={simpleDropdownStyles}
          >
            {preDefinedOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
            <MenuItem value="Other">Other</MenuItem>
          </Select>
          {selectValue === "Other" && (            <TextField
              name="ethnicity"              placeholder="Enter ethnicity"
              value={isPredefined ? "" : clientProfile.ethnicity}
              onChange={handleEthnicityCustomChange}
              sx={{
                backgroundColor: "white",
                width: "100%",
                height: "56px",
                padding: "0.1rem 0.5rem",
                borderRadius: "5px",
                marginTop: "0px",
                '& .MuiOutlinedInput-root': {
                  '&.Mui-focused fieldset': {
                    border: "2px solid #257E68",
                    boxShadow: "0 0 8px rgba(37, 126, 104, 0.4), 0 0 16px rgba(37, 126, 104, 0.2)",
                  },
                },
              }}
            />
          )}
        </Box>
      );
    }

    if (fieldPath === "gender") {
      if (!isEditing) {
        return <Box>{clientProfile.gender}</Box>;
      }
    
      const preDefinedOptions = [
        "Male",
        "Female",
        "Other"
      ];
    
      const isPredefined = preDefinedOptions.includes(clientProfile.gender);
      const selectValue = isPredefined ? clientProfile.gender : "Other";
    
      const handleGenderSelectChange = (e: any) => {
        const newVal = e.target.value;
          // Update with selected value
          handleChange({ target: { name: "gender", value: newVal } } as any);
      };
    
    
      return (        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>          <Select            name="gender"
            value={selectValue}
            onChange={handleGenderSelectChange}
            sx={simpleDropdownStyles}
          >
            {preDefinedOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </Box>
      );
    }

    if (fieldPath === "headOfHousehold") {
      if (!isEditing) {
        return <Box>{clientProfile.headOfHousehold}</Box>;
      }
    
      const preDefinedOptions = [
        "Adult",
        "Senior",
      ];
    
      const isPredefined = preDefinedOptions.includes(clientProfile.headOfHousehold);
      const selectValue = isPredefined ? clientProfile.headOfHousehold : "Adult";
    
      const handleHeadOfHouseholdSelectChange = (e: any) => {
        const newVal = e.target.value;
          // Update with selected value
          handleChange({ target: { name: "headOfHousehold", value: newVal } } as any);
  
      };
    
      return (        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>          <Select            name="headOfHousehold"
            value={selectValue}
            onChange={handleHeadOfHouseholdSelectChange}
            sx={simpleDropdownStyles}
          >
            {preDefinedOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </Box>
      );
    }

        if (fieldPath === "recurrence") {
      if (!isEditing) {
        return <Box>{clientProfile.recurrence}</Box>;
      }
    
      const preDefinedOptions = [
        "None",
        "Weekly",
        "2x-Monthly",
        "Monthly"
      ];
    
      const isPredefined = preDefinedOptions.includes(clientProfile.recurrence);
      const selectValue = isPredefined ? clientProfile.recurrence : "None";
    
      const handleRecurrenceSelectChange = (e: any) => {
        const newVal = e.target.value;
          // Update with selected value
          handleChange({ target: { name: "recurrence", value: newVal } } as any);
  
      };
    
      return (        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>          <Select            name="recurrence"
            value={selectValue}
            onChange={handleRecurrenceSelectChange}
            sx={simpleDropdownStyles}
          >
            {preDefinedOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </Box>
      );
    }


    const value = fieldPath.includes(".")
      ? getNestedValue(clientProfile, fieldPath)
      : clientProfile[fieldPath as keyof ClientProfile];

    // Determine if the field should be disabled
    const isDisabledField = ["city", "state", "zipCode", "quadrant", "ward", "total"].includes(fieldPath);

    return (      <Box sx={{
        transition: "all 0.2s ease",
        '&:hover': {
          transform: isEditing ? 'translateY(-2px)' : 'none',
        },
      }}>
        <FormField
          fieldPath={fieldPath}
          value={value}
          type={type}
          isEditing={isEditing}
          handleChange={handleChange}
          handleDietaryRestrictionChange={handleDietaryRestrictionChange}
          addressInputRef={fieldPath === "address" ? addressInputRef : undefined}
          isDisabledField={isDisabledField}
          getNestedValue={getNestedValue}
          tags={tags}
          allTags={allTags}
          isModalOpen={isModalOpen}
          setIsModalOpen={setIsModalOpen}
          handleTag={handleTag}
          error={errors[fieldPath]}
        />
      </Box>
    );
  };

  const handleTag = async (text: any) => {
    if (!prevTags) {
      setPrevTags(deepCopy(tags));
    }

    let updatedTags: string[];
    if (tags.includes(text)) {
      updatedTags = tags.filter((t) => t !== text);
      console.log(`Removing tag "${text}" from client. Updated tags:`, updatedTags);
    } else if (text.trim() !== "") {
      updatedTags = [...tags, text.trim()];
      console.log(`Adding tag "${text}" to client. Updated tags:`, updatedTags);
    } else {
      return; // No change needed
    }

    // Update local state immediately
    setTags(updatedTags);

    // Update Firebase immediately if we have a client UID
    if (clientProfile.uid) {
      try {
        console.log(`Updating Firebase for client ${clientProfile.uid} with tags:`, updatedTags);
        await setDoc(doc(db, "clients", clientProfile.uid), { tags: updatedTags }, { merge: true });
        console.log("Tags successfully updated in Firebase for client:", clientProfile.uid);
        
        // Also update the local clientProfile.tags to keep it in sync
        setClientProfile(prev => ({
          ...prev,
          tags: updatedTags
        }));
      } catch (error) {
        console.error("Error updating client tags in Firebase:", error);
        console.error("Client UID:", clientProfile.uid);
        console.error("Attempted tags update:", updatedTags);
        // Revert local state if Firebase update fails
        setTags(tags);
        alert(`Failed to update tags in Firebase: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      console.warn("No client UID available, cannot update tags in Firebase");
    }
  };

  // Updated handler for dietary restrictions
  const handleDietaryRestrictionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type } = e.target;
    handlePrevClientCopying();

    if (type === "checkbox") {
      const { checked } = e.target;
      setClientProfile((prevState) => ({
        ...prevState,
        deliveryDetails: {
          ...prevState.deliveryDetails,
          dietaryRestrictions: {
            ...prevState.deliveryDetails.dietaryRestrictions,
            [name]: checked,
            ...(name === "other" && {
              other: checked,
              // Keep the existing otherText when checking, clear it when unchecking
              otherText: checked ? prevState.deliveryDetails.dietaryRestrictions.otherText : ""
            })
          },
        },
      }));
    } else if (type === "text" && name === "otherText") {
      const value = e.target.value;
      setClientProfile((prevState) => ({
        ...prevState,
        deliveryDetails: {
          ...prevState.deliveryDetails,
          dietaryRestrictions: {
            ...prevState.deliveryDetails.dietaryRestrictions,
            otherText: value,
            other: true // Ensure the checkbox stays checked when typing
          },
        },
      }));
    }
  };

  //google places autocomplete
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isGoogleApiLoaded, setIsGoogleApiLoaded] = useState(false);

  // Helper to load Google Maps script if not present
  function loadGoogleMapsScript(apiKey: string, callback: () => void) {
    if (typeof window.google === 'object' && window.google.maps && window.google.maps.places) {
      callback();
      return;
    }
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      existingScript.addEventListener('load', callback);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = callback;
    document.body.appendChild(script);
  }

  // Load Google Maps API on mount
  useEffect(() => {
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key is missing!');
      return;
    }
    loadGoogleMapsScript(apiKey, () => setIsGoogleApiLoaded(true));
  }, []);

  // Initialize Google Places Autocomplete when input and API are ready
  useEffect(() => {
    if (isGoogleApiLoaded && addressInputRef.current && window.google && window.google.maps && window.google.maps.places) {
      if (autocompleteRef.current) return; // Prevent re-initialization
      autocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        types: ["address"],
        componentRestrictions: { country: "us" },
      });
      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current!.getPlace();
        if (!place.address_components) return;
        // Extract address components
        let street = "";
        let city = "";
        let state = "";
        let zip = "";
        let quadrant = "";
        for (const comp of place.address_components) {
          if (comp.types.includes("street_number")) {
            street = comp.long_name + " " + street;
          } else if (comp.types.includes("route")) {
            street += comp.long_name;
          } else if (comp.types.includes("locality")) {
            city = comp.long_name;
          } else if (comp.types.includes("administrative_area_level_1")) {
            state = comp.short_name;
          } else if (comp.types.includes("postal_code")) {
            zip = comp.long_name;
          } else if (comp.types.includes("subpremise")) {
            street += " " + comp.long_name;
          } else if (comp.types.includes("neighborhood")) {
            // Optionally use for quadrant if DC
            if (!quadrant && comp.long_name.match(/(NW|NE|SW|SE)/i)) {
              quadrant = comp.long_name;
            }
          }
        }
        // If DC, try to extract quadrant from formatted address if not found
        if (!quadrant && place.formatted_address && place.formatted_address.match(/(NW|NE|SW|SE)/i)) {
          quadrant = place.formatted_address.match(/(NW|NE|SW|SE)/i)?.[0] || "";
        }
        // Save only the street address in address field
        setClientProfile((prev) => ({
          ...prev,
          address: street.trim(),
          city,
          state,
          zipCode: zip,
          quadrant,
        }));
        setIsAddressValidated(true);
      });
    }
  }, [isGoogleApiLoaded, isEditing]);

  // Remove any stray {fieldPath === 'address' ...} JSX outside renderField

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

    // Clear address validation errors
    setAddressError("");
    setIsAddressValidated(true);
    setUserTypedAddress("");

    // Reset autocomplete instance when cancelling
    if (autocompleteRef.current) {
      try {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      } catch (err) {
        console.warn("Failed to clear listeners during cancel", err);
      }
      autocompleteRef.current = null;
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

  // Add this useEffect after state declarations in the Profile component
  useEffect(() => {
    setClientProfile((prev) => ({
      ...prev,
      total: Number(prev.adults || 0) + Number(prev.children || 0) + Number(prev.seniors || 0),
    }));
  }, [clientProfile.adults, clientProfile.children, clientProfile.seniors]);


    const handleAddDelivery = async (newDelivery: NewDelivery) => {
      try {
        let recurrenceDates: Date[] = [];
  
        //create unique id for each recurrence group. All events for this recurrence will have the same id
        const recurrenceId = crypto.randomUUID();
        if (newDelivery.recurrence === "Custom") {
          // Use customDates directly if recurrence is Custom
          // Ensure customDates exist and map string dates back to Date objects
          recurrenceDates = newDelivery.customDates?.map(dateStr => {
            // Use TimeUtils for proper timezone handling
            return TimeUtils.fromISO(dateStr).toJSDate();
          }) || [];
          // Clear repeatsEndDate explicitly for custom recurrence in the submitted data
          newDelivery.repeatsEndDate = undefined;
        } else {
          // Calculate recurrence dates for standard recurrence types
          const deliveryDate = TimeUtils.fromISO(newDelivery.deliveryDate).toJSDate();
          recurrenceDates =
            newDelivery.recurrence === "None" ? [deliveryDate] : calculateRecurrenceDates(newDelivery);
        }
  
        // Filter out dates that already have a delivery for the same client
        const existingEventDates = new Set(

          events
            .filter(event => event.clientId === newDelivery.clientId)
            .map(event => {
              const jsDate = toJSDate(event.deliveryDate);
              return new DayPilot.Date(jsDate).toString("yyyy-MM-dd");
            })
        );
  
        const uniqueRecurrenceDates = recurrenceDates.filter(date => 
          !existingEventDates.has(new DayPilot.Date(date).toString("yyyy-MM-dd"))
        );
  
        if (uniqueRecurrenceDates.length < recurrenceDates.length) {
          console.warn("Some duplicate delivery dates were detected and skipped.");
        }
  
        // Use DeliveryService to create events for unique dates only
        const deliveryService = DeliveryService.getInstance();
        const createPromises = uniqueRecurrenceDates.map(date => {
          const eventToAdd: Partial<DeliveryEvent> = {
            clientId: newDelivery.clientId,
            clientName: newDelivery.clientName,
            deliveryDate: date, // Use the calculated/provided recurrence date
            recurrence: newDelivery.recurrence,
            time: "",
            cluster: 0,
            recurrenceId: recurrenceId,
          };
  
          // Add customDates array if recurrence is Custom
          if (newDelivery.recurrence === "Custom") {
            eventToAdd.customDates = newDelivery.customDates;
          } else if (newDelivery.repeatsEndDate) {
            // Only add repeatsEndDate for standard recurrence types
            eventToAdd.repeatsEndDate = newDelivery.repeatsEndDate;
          }
  
          return deliveryService.createEvent(eventToAdd);
        });
  
        await Promise.all(createPromises);
  
        // // Refresh events after adding
        // fetchEvents();
      } catch (error) {
        console.error("Error adding delivery:", error);
      }
    };



     const fetchClients = async () => {
    try {
      console.log("Fetching all clients");
      // Use ClientService instead of direct Firebase calls
      const clientService = ClientService.getInstance();
      const clientsData = await clientService.getAllClients();
      
      console.log(`Fetched ${clientsData.length} clients`);
      
      // Map client data to Client type with explicit type casting for compatibility
      const clientList = clientsData.map(data => {
        // Ensure dietaryRestrictions has all required fields
        const dietaryRestrictions = data.deliveryDetails?.dietaryRestrictions || {};
        
        return {
          id: data.uid,
          uid: data.uid,
          // Preserve original casing, only trim whitespace
          firstName: (data.firstName || "").trim(),
          lastName: (data.lastName || "").trim(),
          streetName: data.streetName || "",
          zipCode: (data.zipCode || "").trim(),
          address: (data.address || "").trim(),
          address2: (data.address2 || "").trim(),
          city: (data.city || "").trim(),
          state: (data.state || "").trim(),
          quadrant: data.quadrant || "",
          dob: data.dob || "",
          phone: data.phone || "",
          alternativePhone: data.alternativePhone || "",
          adults: data.adults || 0,
          children: data.children || 0,
          total: data.total || 0,
          gender: data.gender || "Other",
          ethnicity: data.ethnicity || "",
          deliveryDetails: {
            deliveryInstructions: data.deliveryDetails?.deliveryInstructions || "",
            dietaryRestrictions: {
              foodAllergens: dietaryRestrictions.foodAllergens || [],
              halal: dietaryRestrictions.halal || false,
              kidneyFriendly: dietaryRestrictions.kidneyFriendly || false,
              lowSodium: dietaryRestrictions.lowSodium || false,
              lowSugar: dietaryRestrictions.lowSugar || false,
              microwaveOnly: dietaryRestrictions.microwaveOnly || false,
              noCookingEquipment: dietaryRestrictions.noCookingEquipment || false,
              other: dietaryRestrictions.other || [],
              softFood: dietaryRestrictions.softFood || false,
              vegan: dietaryRestrictions.vegan || false,
              vegetarian: dietaryRestrictions.vegetarian || false,
            },
          },
          lifeChallenges: data.lifeChallenges || "",
          notes: data.notes || "",
          notesTimestamp: data.notesTimestamp || null,
          lifestyleGoals: data.lifestyleGoals || "",
          language: data.language || "",
          createdAt: data.createdAt || TimeUtils.now().toJSDate(),
          updatedAt: data.updatedAt || TimeUtils.now().toJSDate(),
          startDate: data.startDate || "",
          endDate: data.endDate || "",
          recurrence: data.recurrence || "None",
          tags: data.tags || [],
          ward: data.ward || "",
          seniors: data.seniors || 0,
          headOfHousehold: data.headOfHousehold || "Adult",
        };
      });
      
      // Cast the result to Client[] to satisfy type checking
      setClients(clientList as unknown as ClientProfile[]);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  return (
    <Box className="profile-container" sx={{ backgroundColor: "#f8f9fa", minHeight: "100vh", pb: 4 }}>
      {showSavePopup && (
        <SaveNotification>
          <SaveIcon fontSize="small" />
          <Typography>Profile saved successfully!</Typography>
        </SaveNotification>
      )}
      {showDuplicatePopup && (
        <ErrorPopUp 
          message={duplicateErrorMessage}
          title="Duplicate Client Detected"
          // No auto-close duration - user must dismiss manually
        />
      )}
      {showSimilarNamesInfo && (
        <PopUp 
          message={similarNamesMessage}
          duration={8000} 
        />
      )}

      {/* Spacer for navbar height */}
      <Box sx={{ height: '64px' }} />

      {/* Enhanced Profile Header */}
      <ProfileHeader
        firstName={clientProfile.firstName}
        lastName={clientProfile.lastName}
        isEditing={isEditing}
        tags={tags}
        allTags={allTags || []}
        handleTag={handleTag}
        clientId={clientProfile.uid || null}
      />

      <Box className="profile-main" sx={{ p: 2 }}>
        <Box
          className="centered-box"
          sx={{
            width: { xs: "95%", sm: "90%", md: "85%", lg: "75%" },
            maxWidth: "1200px",
            bgcolor: "transparent",
            boxShadow: "none",
            p: 0
          }}
        >
          {/* Basic Information Section */}
          <SectionBox mb={3}>
            <Box
              className="box-header"
              display="flex"
              alignItems="center"
              sx={{
                mb: 3,
                pb: 1,
                borderBottom: "1px solid rgba(0,0,0,0.1)",
                justifyContent: "flex-start"
              }}
            >
              <SectionTitle sx={{ textAlign: 'left', width: '100%' }}>
                Basic Information
              </SectionTitle>
              <Box display="flex" alignItems="center" gap={1}>
                <StyledIconButton
                  onClick={() => {
                    if (isEditing) handleCancel();
                    setIsEditing((prev) => !prev);
                  }}
                  size="small"
                >
                  <Tooltip title={isEditing ? "Cancel Editing" : "Edit All"}>
                    {isEditing ? (
                      <span className="cancel-btn">
                        <CloseIcon />
                      </span>
                    ) : (
                      <EditIcon />
                    )}
                  </Tooltip>
                </StyledIconButton>
                {isEditing && (
                  <StyledIconButton
                    color="primary"
                    onClick={handleSave}
                    aria-label="save"
                    size="small"
                  >
                    <SaveIcon />
                  </StyledIconButton>
                )}
              </Box>
            </Box>

            {/* Place Refactored Form Components here */}
            <BasicInfoForm
              isEditing={isEditing}
              clientProfile={clientProfile}
              fieldLabelStyles={fieldLabelStyles}
              renderField={renderField}
              errors={errors}
              selectedCaseWorker={selectedCaseWorker}
              caseWorkers={caseWorkers}
              setShowCaseWorkerModal={setShowCaseWorkerModal}
              handleCaseWorkerChange={handleCaseWorkerChange}
              addressError={addressError} // Add this line
            />
          </SectionBox>

          {/* Delivery Information Section */}
          <SectionBox mb={3}>
            <SectionTitle sx={{ textAlign: 'left', width: '100%' }}>Delivery Information</SectionTitle>
            <DeliveryInfoForm
              isEditing={isEditing}
              clientProfile={clientProfile}
              fieldLabelStyles={fieldLabelStyles}
              renderField={renderField}
              lastDeliveryDate={lastDeliveryDate}
              isSaved={isSaved}
            />
          </SectionBox>

          {/* Dietary Preferences Section */}
          <SectionBox mb={3}>
            <SectionTitle sx={{ textAlign: 'left', width: '100%' }}>Dietary Preferences</SectionTitle>
            <DietaryPreferencesForm
              isEditing={isEditing}
              fieldLabelStyles={fieldLabelStyles}
              dietaryRestrictions={clientProfile.deliveryDetails.dietaryRestrictions}
              renderField={renderField}
            />
          </SectionBox>

          {/* Delivery Log Section */}
          <SectionBox mb={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <SectionTitle sx={{ textAlign: 'left', width: '100%' }}>Deliveries</SectionTitle>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setIsDeliveryModalOpen(true)}
              disabled={userRole === UserType.ClientIntake}
              sx={{
                marginRight: 4,
                width: 166,
                color: "#fff",
                backgroundColor: "#257E68",
              }}
            >
              Add Delivery
            </Button>
            </Box>
            <AddDeliveryDialog
              open={isDeliveryModalOpen}
              onClose={() => setIsDeliveryModalOpen(false)}
              onAddDelivery={handleAddDelivery}
              clients={[]} // Empty array since we're using preSelectedClient
              startDate={new DayPilot.Date()}
              preSelectedClient={{
                clientId: clientId || "",
                clientName: `${clientProfile.firstName} ${clientProfile.lastName}`,
                clientProfile: clientProfile
              }}
            />
           <DeliveryLogForm
              pastDeliveries={pastDeliveries}
              futureDeliveries={futureDeliveries}
              fieldLabelStyles={fieldLabelStyles}
              onDeleteDelivery={async (delivery: DeliveryEvent) => {
                try {
                  // Update the parent component's state to reflect the deletion
                  // Note: Firestore deletion is already handled by DeliveryLogForm
                  const updatedFutureDeliveries = futureDeliveries.filter(d => d.id !== delivery.id);
                  setFutureDeliveries(updatedFutureDeliveries);
                  
                  // Also refresh the delivery history to ensure consistency
                  if (clientId) {
                    const deliveryService = DeliveryService.getInstance();
                    const { futureDeliveries: refreshedFutureDeliveries } = await deliveryService.getClientDeliveryHistory(clientId);
                    setFutureDeliveries(refreshedFutureDeliveries);
                  }
                } catch (error) {
                  console.error('Error updating delivery state after deletion:', error);
                }
              }}
            />
          </SectionBox>

          {/* Miscellaneous Section */}
          <SectionBox>
            <SectionTitle sx={{ textAlign: 'left', width: '100%' }}>Miscellaneous Information</SectionTitle>
            <MiscellaneousForm
              clientProfile={clientProfile}
              isEditing={isEditing}
              renderField={renderField}
              fieldLabelStyles={fieldLabelStyles}
              errors={errors}
            />          </SectionBox>
          <SectionBox sx={{ textAlign: 'right', width: '100%' }}>
            <Box display="flex" alignItems="center" justifyContent="flex-end" gap={1}>
              <StyledIconButton
                  onClick={() => {
                    if (isEditing) handleCancel();
                    setIsEditing((prev) => !prev);
                  }}
                  size="small"
                >
                  <Tooltip title={isEditing ? "Cancel Editing" : "Edit All"}>
                    {isEditing ? (
                      <span className="cancel-btn">
                        <CloseIcon />
                      </span>
                    ) : (
                      <EditIcon />
                    )}
                  </Tooltip>
                </StyledIconButton>
                {isEditing && (
                  <StyledIconButton
                    color="primary"
                    onClick={handleSave}
                    aria-label="save"
                    size="small"
                  >
                    <SaveIcon />
                  </StyledIconButton>
                )}
            </Box>
          </SectionBox>
        </Box> {/* End centered-box */}
      </Box> {/* End profile-main */}

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
