import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import { CalendarUtils, TimeUtils } from "../../utils/timeUtils";
import { getLastDeliveryDateForClient } from "../../utils/lastDeliveryDate";
import { deliveryEventEmitter } from "../../utils/deliveryEventEmitter";
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
import { FormControlLabel, Checkbox } from "@mui/material";
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
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth, db } from "../../auth/firebaseConfig";
import dataSources from "../../config/dataSources";
import { googleMapsApiKey } from "../../config/apiKeys";
import CaseWorkerManagementModal from "../../components/CaseWorkerManagementModal";
import "./Profile.css";
import { clientService } from "../../services/client-service";
import DeliveryService from "../../services/delivery-service";
import PopUp from "../../components/PopUp";
import ErrorPopUp from "../../components/ErrorPopUp";

import BasicInfoForm from "./components/BasicInfoForm";
import DeliveryInfoForm from "./components/DeliveryInfoForm";
import DietaryPreferencesForm from "./components/DietaryPreferencesForm";
import DeliveryLogForm from "./components/DeliveryLogForm";
import FormField from "./components/FormField";
import MiscellaneousForm from "./components/MiscellaneousForm";
import ProfileHeader from "./components/ProfileHeader";
import TagManager from "./Tags/TagManager";

import {
  CalendarConfig,
  CalendarEvent,
  CaseWorker,
  ClientProfile,
  NewDelivery,
  UserType,
} from "../../types";
import { ClientProfileKey, InputType } from "./types";
import { DeliveryEvent } from "../../types/calendar-types";
import { useAuth } from "../../auth/AuthProvider";
import { useClientData } from "../../context/ClientDataContext";
import { Add } from "@mui/icons-material";
import AddDeliveryDialog from "../Calendar/components/AddDeliveryDialog";
import { calculateRecurrenceDates } from "../Calendar/components/CalendarUtils";
import { DayPilot } from "@daypilot/daypilot-lite-react";
import { toJSDate } from "../../utils/timestamp";
import { deliveryDate } from "../../utils/deliveryDate";
import HealthConditionsForm from "./components/HealthConditionsForm";
import HealthCheckbox from "./components/HealthCheckbox";

const fieldStyles = {
  backgroundColor: "var(--color-white)",
  width: "60%",
  height: "1.813rem",
  padding: "var(--spacing-0-1) 0.5rem",
  borderRadius: "5px",
  border: ".1rem solid black",
  marginTop: "0px",
};

const CustomTextField = styled(TextField)({
  "& .MuiOutlinedInput-root": {
    "& fieldset": {
      border: "none",
    },
    "&:hover fieldset": {
      borderColor: "var(--color-primary)",
    },
    "&.Mui-focused fieldset": {
      borderColor: "var(--color-primary)",
      border: "2px solid var(--color-primary)",
    },
  },
  "& .MuiInputBase-input": {
    ...fieldStyles,
    transition: "all 0.3s ease",
    "&:focus": {
      border: "2px solid var(--color-primary)",
      outline: "none",
      boxShadow: "0 0 8px rgba(37, 126, 104, 0.4), 0 0 16px rgba(37, 126, 104, 0.2)",
    },
  },
});

const SectionBox = styled(Box)(({ theme }) => ({
  backgroundColor: "var(--color-white)",
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
  color: "var(--color-white)",
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

const Profile = () => {
  const { refresh } = useClientData();
  const navigate = useNavigate();
  const params = useParams();
  const clientIdParam: string | null = params.clientId ?? null;
  const { user, loading, userRole } = useAuth();

  const [configFields, setConfigFields] = useState<
    Array<{ id: string; label: string; type: string }>
  >([]);
  const [isEditing, setIsEditing] = useState(!clientIdParam);
  const [isNewProfile, setIsNewProfile] = useState(!clientIdParam);
  const [clientId, setClientId] = useState<string | null>(clientIdParam);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState<boolean>(false);
  const [deliveryDataLoaded, setDeliveryDataLoaded] = useState<boolean>(false);
  const [prevTags, setPrevTags] = useState<string[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [prevClientProfile, setPrevClientProfile] = useState<ClientProfile | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfile>({
    uid: "",
    firstName: "",
    lastName: "",
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
        allergies: false,
        allergiesText: "",
        foodAllergens: [],
        otherText: "",
        other: false, // Changed from string to boolean
      },
    },
    lifeChallenges: "",
    notes: "",
    notesTimestamp: null,
    deliveryInstructionsTimestamp: null, // New timestamp field for delivery instructions
    lifeChallengesTimestamp: null, // New timestamp field for life challenges
    lifestyleGoalsTimestamp: null,
    lifestyleGoals: "",
    language: "",
    createdAt: TimeUtils.now().toJSDate(),
    updatedAt: TimeUtils.now().toJSDate(),
    startDate: TimeUtils.now().toFormat("yyyy-MM-dd"),
    endDate: "",
    recurrence: "None",
    tags: [],
    ward: "",
    tefapCert: "",
    referralEntity: null,
    referredDate: "",
    coordinates: [],
    physicalAilments: {
      diabetes: false,
      hypertension: false,
      heartDisease: false,
      kidneyDisease: false,
      cancer: false,
      otherText: "",
      other: false,
    },
    physicalDisability: {
      otherText: "",
      other: false,
    },
    mentalHealthConditions: {
      otherText: "",
      other: false,
    },
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [fieldEditStates, setFieldEditStates] = useState<{ [key: string]: boolean }>({});
  const [formData, setFormData] = useState({});
  const [isSaved, setIsSaved] = useState(false);
  const [ward, setWard] = useState(clientProfile.ward);
  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>({});
  const [lastDeliveryDate, setLastDeliveryDate] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [isProcessingDelivery, setIsProcessingDelivery] = useState<boolean>(false);
  const [prevNotes, setPrevNotes] = useState("");
  const [showSavePopup, setShowSavePopup] = useState(false);
  const [showCaseWorkerModal, setShowCaseWorkerModal] = useState(false);
  const [caseWorkers, setCaseWorkers] = useState<CaseWorker[]>([]);
  const [selectedCaseWorker, setSelectedCaseWorker] = useState<CaseWorker | null>(null);
  const [pastDeliveries, setPastDeliveries] = useState<DeliveryEvent[]>([]);
  const [futureDeliveries, setFutureDeliveries] = useState<DeliveryEvent[]>([]);
  const [events, setEvents] = useState<DeliveryEvent[]>([]);
  const [latestRecurringDelivery, setLatestRecurringDelivery] = useState<DeliveryEvent | null>(
    null
  );

  const preSelectedClientData = useMemo(
    () => ({
      clientId: clientId || clientProfile.uid || "",
      clientName:
        clientProfile.firstName && clientProfile.lastName
          ? `${clientProfile.firstName} ${clientProfile.lastName}`
          : "",
      clientProfile: {
        ...clientProfile,
        recurrence: latestRecurringDelivery?.recurrence || clientProfile.recurrence,
        endDate: latestRecurringDelivery?.repeatsEndDate || clientProfile.endDate,
      },
    }),
    [clientId, clientProfile, latestRecurringDelivery]
  );

  const [foodAllergensText, setFoodAllergensText] = useState<string>("");
  useEffect(() => {
    if (isEditing) {
      const allergensArr = clientProfile.deliveryDetails?.dietaryRestrictions?.foodAllergens;
      setFoodAllergensText(
        Array.isArray(allergensArr) && allergensArr.length > 0 ? allergensArr.join(", ") : ""
      );
    }
  }, [isEditing, clientProfile.deliveryDetails?.dietaryRestrictions?.foodAllergens]);

  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [addressError, setAddressError] = useState<string>("");
  const [userTypedAddress, setUserTypedAddress] = useState<string>("");
  const [isAddressValidated, setIsAddressValidated] = useState<boolean>(true);
  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);
  const [duplicateErrorMessage, setDuplicateErrorMessage] = useState(
    "A client with this name and address already exists in the system."
  );
  const [showSimilarNamesInfo, setShowSimilarNamesInfo] = useState(false);
  const [similarNamesMessage, setSimilarNamesMessage] = useState("");

  const getProfileById = async (id: string) => {
    const docRef = doc(db, dataSources.firebase.clientsCollection, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();

      const normalizedData = {
        ...data,
        notes: data.notes || "",
        lifeChallenges: data.lifeChallenges || "",
        lifestyleGoals: data.lifestyleGoals || "",
        deliveryDetails: {
          deliveryInstructions: data.deliveryDetails?.deliveryInstructions || "",
          dietaryRestrictions: {
            lowSugar: data.deliveryDetails?.dietaryRestrictions?.lowSugar || false,
            kidneyFriendly: data.deliveryDetails?.dietaryRestrictions?.kidneyFriendly || false,
            vegan: data.deliveryDetails?.dietaryRestrictions?.vegan || false,
            vegetarian: data.deliveryDetails?.dietaryRestrictions?.vegetarian || false,
            halal: data.deliveryDetails?.dietaryRestrictions?.halal || false,
            microwaveOnly: data.deliveryDetails?.dietaryRestrictions?.microwaveOnly || false,
            softFood: data.deliveryDetails?.dietaryRestrictions?.softFood || false,
            lowSodium: data.deliveryDetails?.dietaryRestrictions?.lowSodium || false,
            noCookingEquipment:
              data.deliveryDetails?.dietaryRestrictions?.noCookingEquipment || false,
            heartFriendly: data.deliveryDetails?.dietaryRestrictions?.heartFriendly || false,
            allergies: data.deliveryDetails?.dietaryRestrictions?.allergies || false,
            allergiesText: data.deliveryDetails?.dietaryRestrictions?.allergiesText || "",
            foodAllergens: data.deliveryDetails?.dietaryRestrictions?.foodAllergens || [],
            otherText: data.deliveryDetails?.dietaryRestrictions?.otherText || "",
            other: data.deliveryDetails?.dietaryRestrictions?.other || false,
            dietaryPreferences: data.deliveryDetails?.dietaryRestrictions?.dietaryPreferences || "",
            ...data.deliveryDetails?.dietaryRestrictions,
          },
        },
      };

      return normalizedData as ClientProfile;
    } else {
      return null;
    }
  };

  useEffect(() => {
    async function fetchConfigFromBucket() {
      try {
        const { getProfileFieldsConfigUrl } = await import("../../services/firebase-storage");
        const configUrl = await getProfileFieldsConfigUrl();
        const response = await fetch(configUrl);
        if (!response.ok) throw new Error("Failed to fetch config file");
        const configData = await response.json();
        if (Array.isArray(configData.miscellaneousFields)) {
          setConfigFields(configData.miscellaneousFields);
        } else {
          setConfigFields([]);
        }
      } catch (err) {
        console.error("Error fetching config from bucket:", err);
        setConfigFields([]);
      }
    }
    fetchConfigFromBucket();
  }, []);
  React.useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  //get list of all tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const tagsDocRef = doc(
          db,
          dataSources.firebase.tagsCollection,
          dataSources.firebase.tagsDocId
        );
        const tagsDocSnap = await getDoc(tagsDocRef);

        if (tagsDocSnap.exists()) {
          const tagsArray = tagsDocSnap.data().tags;
          setAllTags(tagsArray);
        } else {
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
          // Remove config-driven dynamic fields from top-level profileData
          if (profileData.miscellaneousDynamicFields) {
            const configFieldIds: string[] = Array.isArray(configFields)
              ? configFields.map((f) => f.id)
              : Object.keys(profileData.miscellaneousDynamicFields);
            for (const key of configFieldIds) {
              if (key in profileData) {
                delete (profileData as unknown as Record<string, unknown>)[key];
              }
            }
            setDynamicFields(profileData.miscellaneousDynamicFields || {});
          }
          setClientProfile(profileData);
          // Set prevNotes only when the profile is loaded from Firebase
          if (!profileLoaded) {
            setPrevNotes(profileData.notes || "");
            setProfileLoaded(true);
          }
        }
      });
    } else {
      setIsNewProfile(true);
      setClientProfile({
        ...clientProfile,
        createdAt: new Date(),
        updatedAt: new Date(),
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
          const latestEndDateString = await getLastDeliveryDateForClient(clientId);

          if (latestEndDateString) {
            setLastDeliveryDate(latestEndDateString);
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
    const handleDeliveryChange = async () => {
      if (clientId) {
        try {
          const latestEndDateString = await getLastDeliveryDateForClient(clientId);
          if (latestEndDateString) {
            setLastDeliveryDate(latestEndDateString);
          } else {
            setLastDeliveryDate("No deliveries found");
          }
        } catch (error) {
          console.error("Error fetching updated last delivery date:", error);
          setLastDeliveryDate("Error fetching data");
        }
      }
    };

    const unsubscribe = deliveryEventEmitter.subscribe(handleDeliveryChange);
    return unsubscribe;
  }, [clientId]);

  useEffect(() => {
    const fetchCaseWorkers = async () => {
      try {
        const caseWorkersCollectionRef = collection(db, dataSources.firebase.caseWorkersCollection);
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
        const { pastDeliveries, futureDeliveries } = await deliveryService.getClientDeliveryHistory(
          clientId!
        );
        setPastDeliveries(pastDeliveries);
        setFutureDeliveries(futureDeliveries);

        // Find the latest recurring delivery from all deliveries (past and future)
        const allDeliveries = [...pastDeliveries, ...futureDeliveries];

        const recurringDeliveries = allDeliveries.filter(
          (delivery) => delivery.recurrence && delivery.recurrence !== "None"
        );

        if (recurringDeliveries.length > 0) {
          // Sort by delivery date (most recent first) and take the first one
          const sortedRecurring = recurringDeliveries.sort((a, b) => {
            const dateA = toJSDate(a.deliveryDate);
            const dateB = toJSDate(b.deliveryDate);
            return dateB.getTime() - dateA.getTime();
          });
          setLatestRecurringDelivery(sortedRecurring[0]);
        } else {
          setLatestRecurringDelivery(null);
        }

        setDeliveryDataLoaded(true);
      } catch (error) {
        console.error("Failed to fetch delivery history", error);
      }
    };
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
      const clientsRef = collection(db, dataSources.firebase.clientsCollection);
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
    let wardName;

    try {
      // First get coordinates for the address
      const coordinates = await getCoordinates(searchAddress);

      if (
        !coordinates ||
        coordinates.length !== 2 ||
        coordinates[0] === 0 ||
        coordinates[1] === 0
      ) {
        wardName = "No address";
        clientProfile.ward = wardName;
        setWard(wardName);
        return wardName;
      }

      // Use DC Government ArcGIS REST service to find ward by coordinates
      // coordinates are in [lat, lng] format, but ArcGIS expects x,y (lng,lat)
      const lng = coordinates[1];
      const lat = coordinates[0];

      const wardServiceURL = dataSources.externalApi.dcGisWardServiceUrl;
      const params = new URLSearchParams({
        f: "json",
        geometry: `${lng},${lat}`,
        geometryType: "esriGeometryPoint",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        outFields: "NAME,WARD",
        returnGeometry: "false",
      });

      const response = await fetch(`${wardServiceURL}?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();

      // Check if we found a ward
      if (data.features && data.features.length > 0) {
        const wardFeature = data.features[0];
        wardName = wardFeature.attributes.NAME || `Ward ${wardFeature.attributes.WARD}`;
      } else {
        wardName = "No ward";
      }
    } catch (error) {
      console.error("Error fetching ward information:", error);
      wardName = "Error";
    }

    clientProfile.ward = wardName;
    setWard(wardName);
    return wardName;
  };

  const getWardAndCoordinates = async (searchAddress: string) => {
    // Compose full address string for geocoding
    const fullAddress = [
      clientProfile.address,
      clientProfile.address2,
      clientProfile.city,
      clientProfile.state,
      clientProfile.zipCode,
    ]
      .filter(Boolean)
      .join(", ");
    let wardName;
    let coordinates;

    try {
      // Get coordinates for the full address
      coordinates = await getCoordinates(fullAddress);

      if (
        !coordinates ||
        coordinates.length !== 2 ||
        coordinates[0] === 0 ||
        coordinates[1] === 0
      ) {
        wardName = "No address";
        return { ward: wardName, coordinates };
      }

      // Use DC Government ArcGIS REST service to find ward by coordinates
      // coordinates are in [lat, lng] format, but ArcGIS expects x,y (lng,lat)
      const lng = coordinates[1];
      const lat = coordinates[0];

      const wardServiceURL = dataSources.externalApi.dcGisWardServiceUrl;
      const params = new URLSearchParams({
        f: "json",
        geometry: `${lng},${lat}`,
        geometryType: "esriGeometryPoint",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        outFields: "NAME,WARD",
        returnGeometry: "false",
      });

      const response = await fetch(`${wardServiceURL}?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();

      // Check if we found a ward
      if (data.features && data.features.length > 0) {
        const wardFeature = data.features[0];
        wardName = wardFeature.attributes.NAME || `Ward ${wardFeature.attributes.WARD}`;
      } else {
        wardName = "No ward";
      }
    } catch (error) {
      wardName = "Error";
    }

    return { ward: wardName, coordinates };
  };

  const getCoordinates = async (address: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("https://geocode-addresses-endpoint-lzrplp4tfa-uc.a.run.app", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          addresses: [address],
        }),
      });

      //API returns {[coordinates[]]} so destructure and return index 0
      if (response.ok) {
        const json = await response.json();
        const { coordinates } = json;
        return coordinates[0];
      }
    } catch (error) {
      //[0,0] is an invalid coordinate handled in DelivertSpreadsheet.tsx
      return [0, 0];
    }
  };

  const toggleFieldEdit = (fieldName: ClientProfileKey) => {
    setFieldEditStates((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
  };

  function deepCopy<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as T;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => deepCopy(item)) as unknown as T;
    }

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
    console.log('[DEBUG handleChange]', name, value);
    setIsSaved(false);
    handlePrevClientCopying();

    if (name === "address") {
      if (addressError) {
        setAddressError("");
        setIsAddressValidated(true);
      }
    }

    // Always format these fields as MM/DD/YYYY
    if (["dob", "tefapCert", "startDate", "endDate"].includes(name)) {
      let formatted = value;
      if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Convert YYYY-MM-DD to MM/DD/YYYY
        const [year, month, day] = value.split("-");
        formatted = `${month}/${day}/${year}`;
      }
      setClientProfile((prevState) => ({
        ...prevState,
        [name]: formatted,
      }));
      return;
    } else if (name === "adults" || name === "children" || name === "seniors") {
      if (Number(value) < 0) {
        return; //do nothing if the input is negative
      }
      setClientProfile((prevState) => ({
        ...prevState,
        [name]: Number(value),
      }));
    } else if (name === "phone" || name === "alternativePhone") {
      setClientProfile((prevState) => {
        const updatedProfile = {
          ...prevState,
          [name]: value,
        };

        const countDigits = (str: string) => (str.match(/\d/g) || []).length;
        const isValidPhoneFormat = (phone: string) => {
          return /^(\+\d{1,2}\s?)?((\(\d{3}\))|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}$/.test(phone);
        };
        const newErrors = { ...errors };

        if (name === "phone" || name === "alternativePhone") {
          if (value.trim() === "" && name === "phone") {
            newErrors[name] = "Phone is required";
          } else if (countDigits(value) < 10) {
            newErrors[name] = "Phone number must contain at least 10 digits";
          } else if (!isValidPhoneFormat(value)) {
            newErrors[name] =
              `"${value}" is an invalid format. Please see the i icon for allowed formats.`;
          } else {
            delete newErrors[name];
          }
        }

        setErrors(newErrors);
        return updatedProfile;
      });
    } else {
      setClientProfile((prevState) => {
        let updatedProfile = {
          ...prevState,
          [name]: value,
        };
        // Special handling for deliveryInstructions field
        if (name === "deliveryDetails.deliveryInstructions") {
          updatedProfile = {
            ...updatedProfile,
            deliveryDetails: {
              ...updatedProfile.deliveryDetails,
              deliveryInstructions: value,
            },
          };
        }
        if (name === "notes") {
          // Special handling for notes field
        }
        return updatedProfile;
      });
    }
  };

  const validateProfile = () => {
    const newErrors: { [key: string]: string } = {};

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
    if (
      clientProfile.state !== "DC" &&
      clientProfile.state !== "MD" &&
      clientProfile.state !== "VA"
    ) {
      newErrors.state = "State must be DC, MD, or VA";
    }
    if (
      clientProfile.email?.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientProfile.email.trim())
    ) {
      newErrors.email = "Invalid email format";
    }

    if (clientProfile.tefapCert?.trim()) {
      const tefapDate = new Date(clientProfile.tefapCert);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (!isNaN(tefapDate.getTime()) && tefapDate > today) {
        newErrors.tefapCert = "TEFAP CERT date cannot be in the future";
      }
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
    if (!clientProfile.referralEntity || !clientProfile.referralEntity.id) {
      newErrors.referralEntity = "Referral entity is required";
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
    } // Validate that the total number of household members is not zero
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
      newErrors.phone = "Phone number must contain at least 10 digits";
    } else if (!isValidPhoneFormat(clientProfile.phone)) {
      newErrors.phone = `"${clientProfile.phone}" is an invalid format. Please see the i icon for allowed formats.`;
    }
    if (
      clientProfile.alternativePhone?.trim() &&
      (countDigits(clientProfile.alternativePhone) < 10 ||
        !isValidPhoneFormat(clientProfile.alternativePhone))
    ) {
      newErrors.alternativePhone = `"${clientProfile.alternativePhone}" is an invalid format. Please see the i icon for allowed formats.`;
    }

    //validate head of household logic
    if (
      (clientProfile.headOfHousehold === "Senior" && clientProfile.seniors == 0) ||
      (clientProfile.headOfHousehold === "Adult" && clientProfile.adults == 0)
    ) {
      newErrors.headOfHousehold = `Head of household is ${clientProfile.headOfHousehold} but no ${clientProfile.headOfHousehold} listed`;
    }

    // Validate referral entity if it exists
    if (clientProfile.referralEntity) {
      if (
        !clientProfile.referralEntity.id ||
        !clientProfile.referralEntity.name ||
        !clientProfile.referralEntity.organization
      ) {
        // Don't block saving if referral entity data is incomplete
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
      return { notes: newNotes, timestamp: new Date() };
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

  const checkDuplicateClient = async (
    firstName: string,
    lastName: string,
    address: string,
    address2: string,
    zipCode: string,
    excludeUid?: string
  ): Promise<boolean | DuplicateCheckResult> => {
    // Normalize inputs for comparison only
    const normalizeString = (str: string) => (str || "").trim().toLowerCase();
    const normalizedFirstName = normalizeString(firstName);
    const normalizedLastName = normalizeString(lastName);
    const normalizedAddress = normalizeString(address);
    const normalizedAddress2 = normalizeString(address2);
    const normalizedZipCode = normalizeString(zipCode);

    // Skip check if any required field is empty
    if (!normalizedFirstName || !normalizedLastName || !normalizedAddress || !normalizedZipCode) {
      return false;
    }

    // Query Firestore for all clients with the same address and zip code
    // use imported singleton clientService directly
    const db = clientService["db"];
    const clientsCollection = clientService["clientsCollection"];
    const addressZipQuery = query(
      collection(db, clientsCollection),
      where("address", "==", address),
      where("address2", "==", address2),
      where("zipCode", "==", zipCode)
    );
    const addressZipSnapshot = await getDocs(addressZipQuery);

    // Filter for same name (case-insensitive)
    const sameNameClients = addressZipSnapshot.docs.filter((docSnap) => {
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
      const zipQuery = query(collection(db, clientsCollection), where("zipCode", "==", zipCode));
      const zipSnapshot = await getDocs(zipQuery);
      sameNameDiffAddressCount = zipSnapshot.docs.filter((docSnap) => {
        const data = docSnap.data();
        return (
          normalizeString(data.firstName) === normalizedFirstName &&
          normalizeString(data.lastName) === normalizedLastName &&
          (normalizeString(data.address) !== normalizedAddress ||
            normalizeString(data.address2) !== normalizedAddress2) &&
          (!excludeUid || data.uid !== excludeUid)
        );
      }).length;
    }

    if (duplicateFound) {
      return {
        isDuplicate: true,
        sameNameCount: sameNameClientsCount,
        sameNameDiffAddressCount,
      };
    }

    if (sameNameDiffAddressCount > 0) {
      return {
        isDuplicate: false,
        sameNameCount: 0,
        sameNameDiffAddressCount,
      };
    }

    return false;
  };

  const handleSave = async () => {
          // Helper to ensure MM/DD/YYYY format
          function toMMDDYYYY(dateStr: string) {
            if (!dateStr) return "";
            if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) return dateStr; // already correct
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              const [year, month, day] = dateStr.split("-");
              return `${month}/${day}/${year}`;
            }
            return dateStr;
          }
    // Important: First validate basic requirements
    setIsSaving(true);
    const validation = validateProfile();

    // Check for address validation error
    if (addressError) {
      alert(
        "Please fix the address error before saving. Make sure to select a valid address from the Google Places suggestions."
      );
      setIsSaving(false);
      return;
    }

    if (Object.keys(validation).length > 0) {
      const errorFields = Object.entries(validation)
        .map(([field, message]) => `- ${message}`)
        .join("\n");
      alert(`Please fix the following before saving:\n${errorFields}`);
      setIsSaving(false);
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
          String(clientProfile.address2).trim(),
          String(clientProfile.zipCode).trim()
        );

        let isDuplicate = false;
        let sameNameCount = 0;
        let sameNameDiffAddressCount = 0;

        // Handle different result formats
        if (typeof duplicateResult === "boolean") {
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
          const warningMsg = `Note: There ${sameNameDiffAddressCount === 1 ? "is" : "are"} ${sameNameDiffAddressCount} other client${sameNameDiffAddressCount === 1 ? "" : "s"} with the name "${clientProfile.firstName} ${clientProfile.lastName}" in ZIP code "${clientProfile.zipCode}", but at different addresses.`;
          setSimilarNamesMessage(warningMsg);
          setShowSimilarNamesInfo(true);
        }
      } else {
        // Force duplicate check to always happen with direct values, not through variables
        const duplicateResult = await checkDuplicateClient(
          String(clientProfile.firstName).trim(),
          String(clientProfile.lastName).trim(),
          String(clientProfile.address).trim(),
          String(clientProfile.address2).trim(),
          String(clientProfile.zipCode).trim(),
          String(clientProfile.uid)
        );

        let isDuplicate = false;
        let sameNameCount = 0;
        let sameNameDiffAddressCount = 0;

        // Handle different result formats
        if (typeof duplicateResult === "boolean") {
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
          const warningMsg = `Note: There ${sameNameDiffAddressCount === 1 ? "is" : "are"} ${sameNameDiffAddressCount} other client${sameNameDiffAddressCount === 1 ? "" : "s"} with the name "${clientProfile.firstName} ${clientProfile.lastName}" in ZIP code "${clientProfile.zipCode}", but at different addresses.`;
          setSimilarNamesMessage(warningMsg);
          setShowSimilarNamesInfo(true);
        }
      }
      // --- Geocoding Optimization Start ---
      // Always force geocoding and coordinate update on every save
      const { ward: fetchedWard, coordinates: fetchedCoordinates } = await getWardAndCoordinates(
        clientProfile.address
      );
      const coordinatesToSave = fetchedCoordinates;
      // Update the ward state
      clientProfile.ward = fetchedWard;
      setWard(fetchedWard);
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
      const prevDeliveryInstructions =
        prevClientProfile?.deliveryDetails.deliveryInstructions || "";
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
      // Only save config-defined dynamic fields
      let configFieldIds: string[] = [];
      // Get config-driven dynamic field IDs
      if (window && window.localStorage) {
        try {
          const config = JSON.parse(window.localStorage.getItem("profileFieldsConfig") || "{}");
          if (Array.isArray(config.miscellaneousFields)) {
            configFieldIds = config.miscellaneousFields.map((f: any) => f.id);
          }
        } catch (err) {
          // Intentionally ignore config load errors; fallback will be used
        }
      }
      if (configFieldIds.length === 0) {
        configFieldIds = Object.keys(dynamicFields);
      }
      // Filter dynamic fields to only config-driven ones
      const filteredDynamicFields = Object.fromEntries(
        Object.entries(dynamicFields).filter(([key]) => configFieldIds.includes(key))
      );
      // Remove ALL config-driven dynamic field keys from top-level profile before saving
      const cleanedProfile = { ...clientProfile };
      for (const key of configFieldIds) {
        if (key in cleanedProfile) {
          delete (cleanedProfile as Record<string, unknown>)[key];
        }
      }
      // Convert all date fields from mm/dd/yyyy to backend format (e.g., yyyy-mm-dd) here
      const convertDateForSave = (dateStr: string | null | undefined) => {
        if (!dateStr || typeof dateStr !== "string" || !dateStr.includes("/")) return dateStr ?? "";
        const [month, day, year] = dateStr.split("/");
        if (month && day && year) {
          const paddedMonth = month.padStart(2, "0");
          const paddedDay = day.padStart(2, "0");
          return `${year}-${paddedMonth}-${paddedDay}`;
        }
        return dateStr;
      };

      // Set activeStatus based on today's date and start/end date
      let activeStatus = false;
      try {
        const today = TimeUtils.now().startOf('day');
        const start = cleanedProfile.startDate ? TimeUtils.fromAny(cleanedProfile.startDate).startOf('day') : null;
        const end = cleanedProfile.endDate ? TimeUtils.fromAny(cleanedProfile.endDate).startOf('day') : null;
        if (start && end && today >= start && today <= end) {
          activeStatus = true;
        }
      } catch (e) {
        // fallback: leave as false
      }
      const updatedProfile: ClientProfile = {
        ...cleanedProfile,
        // Example: convert specific date fields
        dob: convertDateForSave(cleanedProfile.dob),
        tefapCert: convertDateForSave(cleanedProfile.tefapCert),
        famStartDate: convertDateForSave(cleanedProfile.famStartDate),
        startDate: toMMDDYYYY(cleanedProfile.startDate),
        endDate: toMMDDYYYY(cleanedProfile.endDate),
        tags: tags, // Sync the tags state with clientProfile
        notesTimestamp: updatedNotesTimestamp, // Update the notesTimestamp
        deliveryInstructionsTimestamp: updatedDeliveryInstructionsTimestamp,
        lifeChallengesTimestamp: updatedLifeChallengesTimestamp,
        lifestyleGoalsTimestamp: updatedLifestyleGoalsTimestamp,
        updatedAt: new Date(),
        total:
          Number(clientProfile.adults || 0) +
          Number(clientProfile.children || 0) +
          Number(clientProfile.seniors || 0),
        ward: fetchedWard, // Use potentially updated ward
        coordinates: coordinatesToSave, // Use potentially updated coordinates
        referralEntity: selectedCaseWorker
          ? {
              id: selectedCaseWorker.id,
              name: selectedCaseWorker.name,
              organization: selectedCaseWorker.organization,
            }
          : null, // Use null if no case worker is selected
        activeStatus,
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
          createdAt: new Date(), // Set createdAt for new profile
        };
        // Save to Firestore for new profile
        await setDoc(doc(db, dataSources.firebase.clientsCollection, newUid), newProfile);
        // Update the central tags list
        await setDoc(
          doc(db, dataSources.firebase.tagsCollection, dataSources.firebase.tagsDocId),
          { tags: sortedAllTags },
          { merge: true }
        );
        // Update state *before* navigating
        setClientProfile(newProfile); // Update with the full new profile data including UID/createdAt
        setPrevClientProfile(null); // Clear previous state backup
        setPrevNotes(newProfile.notes || ""); // Update prevNotes with saved notes
        setIsNewProfile(false); // No longer a new profile
        setClientId(newUid); // Set the clientId state for the current view
        setIsSaved(true); // Indicate save was successful
        setErrors({}); // Clear validation errors
        setAllTags(sortedAllTags); // Update the local list of all tags
        // Refresh client data context so spreadsheet updates
        if (refresh) await refresh();
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
        await setDoc(
          doc(db, dataSources.firebase.clientsCollection, clientProfile.uid),
          updatedProfile,
          { merge: true }
        ); // Use merge: true for updates
        // Update the central tags list
        await setDoc(
          doc(db, dataSources.firebase.tagsCollection, dataSources.firebase.tagsDocId),
          { tags: sortedAllTags },
          { merge: true }
        );
        // Update state *after* successful save for existing profile
        setClientProfile(updatedProfile); // Update with latest data
        setPrevClientProfile(null); // Clear previous state backup
        setPrevNotes(updatedProfile.notes || ""); // Update prevNotes
        setIsSaved(true); // Indicate save was successful
        setErrors({}); // Clear validation errors
        setAllTags(sortedAllTags); // Update the local list of all tags
        // Refresh client data context so spreadsheet updates
        if (refresh) await refresh();
      }

      // Common post-save actions (Popup notification)
      // setEditMode(false); <-- Removed redundant call
      setShowSavePopup(true);
      setIsEditing(false);
      setTimeout(() => setShowSavePopup(false), 2000);
    } catch (e) {
      console.error("Error saving document: ", e);
      alert(`Failed to save profile: ${e instanceof Error ? e.message : String(e)}`);
      // Consider keeping isEditing true or providing more feedback
    } finally {
      // Hide saving indicator? (Optional)
      // setIsLoading(false);
      setIsSaving(false);
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

  // Re-define renderField to accept addressInputRef and forward it to FormField
  const renderField = (
    fieldPath: ClientProfileKey,
    type: InputType = "text",
    addressInputRef?: React.RefObject<HTMLInputElement | null>
  ) => {
    if (type === "physicalAilments") {
      const options = [
        { name: "diabetes", label: "Diabetes" },
        { name: "hypertension", label: "Hypertension" },
        { name: "heartDisease", label: "Heart Disease" },
        { name: "kidneyDisease", label: "Kidney Disease" },
        { name: "cancer", label: "Cancer" },
      ];

      return (
        <>
          {options.map((option) => (
            <HealthCheckbox
              key={option.name}
              checked={Boolean(
                clientProfile.physicalAilments?.[
                  option.name as keyof typeof clientProfile.physicalAilments
                ]
              )}
              onChange={handlePhysicalAilmentsChange}
              name={option.name}
              label={option.label}
              isEditing={isEditing}
            />
          ))}
          <HealthCheckbox
            checked={clientProfile.physicalAilments?.other || false}
            onChange={handlePhysicalAilmentsChange}
            name="other"
            label="Other"
            showOtherText={true}
            otherTextValue={clientProfile.physicalAilments?.otherText || ""}
            placeholder="Please specify other physical ailments"
            isEditing={isEditing}
          />
        </>
      );
    }

    if (type === "physicalDisability") {
      return (
        <HealthCheckbox
          checked={clientProfile.physicalDisability?.other || false}
          onChange={handlePhysicalDisabilityChange}
          name="other"
          label="Other"
          showOtherText={true}
          otherTextValue={clientProfile.physicalDisability?.otherText || ""}
          placeholder="Please specify other physical disabilities"
          isEditing={isEditing}
        />
      );
    }

    if (type === "mentalHealthConditions") {
      return (
        <HealthCheckbox
          checked={clientProfile.mentalHealthConditions?.other || false}
          onChange={handleMentalHealthConditionsChange}
          name="other"
          label="Other"
          showOtherText={true}
          otherTextValue={clientProfile.mentalHealthConditions?.otherText || ""}
          placeholder="Please specify other mental health conditions"
          isEditing={isEditing}
        />
      );
    }

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
        { name: "heartFriendly", label: "Heart Friendly" },
      ] as const;

      interface DietaryOption {
        name:
          | "lowSugar"
          | "kidneyFriendly"
          | "vegan"
          | "vegetarian"
          | "halal"
          | "microwaveOnly"
          | "softFood"
          | "lowSodium"
          | "noCookingEquipment"
          | "heartFriendly";
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
        allergies: boolean;
        allergiesText: string;
        other: boolean;
        otherText: string;
      }

      return (
        <>
          {dietaryOptions.map((option: DietaryOption) => {
            return (
              <HealthCheckbox
                key={option.name}
                checked={Boolean(clientProfile.deliveryDetails?.dietaryRestrictions?.[option.name])}
                onChange={handleDietaryRestrictionChange}
                name={option.name}
                label={option.label}
                isEditing={isEditing}
              />
            );
          })}

          {/* Allergies title and text box */}
          <Box sx={{ width: "100%" }}>
            <Typography
              className="field-descriptor"
              sx={{ fontWeight: 700, fontSize: "1rem", mb: "10px" }}
            >
              ALLERGIES
            </Typography>
            {isEditing ? (
              <CustomTextField
                name="foodAllergensText"
                value={foodAllergensText}
                onChange={(e) => {
                  setFoodAllergensText(e.target.value);
                }}
                onBlur={(e) => {
                  // On blur, update state and array
                  const value = e.target.value;
                  handlePrevClientCopying();
                  setClientProfile((prev) => ({
                    ...prev,
                    deliveryDetails: {
                      ...prev.deliveryDetails,
                      dietaryRestrictions: {
                        ...prev.deliveryDetails?.dietaryRestrictions,
                        foodAllergens: value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                        allergiesText: value,
                      },
                    },
                  }));
                }}
                placeholder="Please specify allergies (e.g. peanuts, shellfish)"
                variant="outlined"
                size="small"
                multiline
                minRows={2}
                sx={{
                  width: "105%",
                  marginLeft: 0,
                  resize: "vertical",
                  "& textarea": { resize: "vertical" },
                  "& .MuiOutlinedInput-root": {
                    "&.Mui-focused fieldset": { borderColor: "var(--color-primary)" },
                  },
                }}
              />
            ) : (
              <Typography
                sx={{
                  width: "105%",
                  fontSize: "1rem",
                  padding: "10px",
                  minHeight: "48px",
                  textAlign: "left",
                }}
              >
                {clientProfile.deliveryDetails?.dietaryRestrictions?.foodAllergens?.join(", ") ||
                  ""}
              </Typography>
            )}
          </Box>

          {/* Other title and text box */}
          <Box sx={{ width: "100%" }}>
            <Typography
              className="field-descriptor"
              sx={{ fontWeight: 700, fontSize: "1rem", mb: "10px" }}
            >
              OTHER
            </Typography>
            {isEditing ? (
              <CustomTextField
                name="otherText"
                value={clientProfile.deliveryDetails?.dietaryRestrictions?.otherText || ""}
                onChange={handleDietaryRestrictionChange}
                placeholder="Please specify other dietary restrictions"
                variant="outlined"
                size="small"
                multiline
                minRows={2}
                sx={{
                  width: "105%",
                  marginLeft: 0,
                  resize: "vertical",
                  "& textarea": { resize: "vertical" },
                  "& .MuiOutlinedInput-root": {
                    "&.Mui-focused fieldset": { borderColor: "var(--color-primary)" },
                  },
                }}
              />
            ) : (
              <Typography
                sx={{
                  width: "105%",
                  fontSize: "1rem",
                  padding: "10px",
                  minHeight: "48px",
                  textAlign: "left",
                }}
              >
                {clientProfile.deliveryDetails?.dietaryRestrictions?.otherText || ""}
              </Typography>
            )}
          </Box>

          {/* Dietary Preferences textarea */}
          {/* Dietary Preferences Subsection Heading */}
          <Box sx={{ width: "100%", mt: 3 }}>
            <SectionTitle sx={{ textAlign: "left", width: "100%" }}>
              Dietary Preferences
            </SectionTitle>
            <Typography
              className="field-descriptor"
              sx={{ fontWeight: 700, fontSize: "1rem", mb: "10px" }}
            >
              DIETARY PREFERENCES
            </Typography>
            {isEditing ? (
              <CustomTextField
                name="dietaryPreferences"
                value={
                  typeof clientProfile.deliveryDetails?.dietaryRestrictions?.dietaryPreferences ===
                  "string"
                    ? clientProfile.deliveryDetails?.dietaryRestrictions?.dietaryPreferences
                    : ""
                }
                onChange={handleDietaryRestrictionChange}
                placeholder="Please specify dietary preferences (e.g. kosher, gluten-free)"
                variant="outlined"
                size="small"
                multiline
                minRows={2}
                error={!!errors["deliveryDetails.dietaryRestrictions.dietaryPreferences"]}
                sx={{
                  width: "105%",
                  marginLeft: 0,
                  resize: "vertical",
                  "& textarea": { resize: "vertical", textAlign: "left !important" },
                  "& .MuiOutlinedInput-root": {
                    "&.Mui-focused fieldset": { borderColor: "var(--color-primary)" },
                  },
                }}
                inputProps={{ style: { textAlign: "left" } }}
              />
            ) : (
              <Typography
                sx={{
                  width: "105%",
                  fontSize: "1rem",
                  padding: "10px",
                  minHeight: "48px",
                  textAlign: "left",
                }}
              >
                {typeof clientProfile.deliveryDetails?.dietaryRestrictions?.dietaryPreferences ===
                "string"
                  ? clientProfile.deliveryDetails?.dietaryRestrictions?.dietaryPreferences
                  : ""}
              </Typography>
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
            error={!!errors.language}
            sx={{
              backgroundColor: "var(--color-white)",
              width: "100%",
              height: "1.813rem",
              padding: "var(--spacing-0-1) 0.5rem",
              borderRadius: "5px",
              border: errors.language ? "1px solid red" : ".1rem solid black", // ← Add this conditional border
              marginTop: "0px",
            }}
          >
            {preDefinedOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
            <MenuItem value="Other">Other</MenuItem>
          </Select>
          {selectValue === "Other" && (
            <TextField
              name="language"
              placeholder="Enter language"
              value={isPredefined ? "" : clientProfile.language}
              onChange={handleCustomLanguageChange}
              sx={{
                backgroundColor: "var(--color-white)",
                width: "100%",
                height: "1.813rem",
                padding: "var(--spacing-0-1) 0.5rem",
                borderRadius: "5px",
                marginTop: "0px",
                "& .MuiOutlinedInput-root": {
                  "& fieldset": {
                    border: errors.language ? "1px solid #d32f2f" : "1px solid black", // Red border on error
                  },
                  "&.Mui-focused fieldset": {
                    border: errors.language ? "2px solid #d32f2f" : "2px solid #257E68", // Red focus border on error
                    boxShadow: errors.language
                      ? "0 0 8px rgba(211, 47, 47, 0.4), 0 0 16px rgba(211, 47, 47, 0.2)"
                      : "0 0 8px rgba(37, 126, 104, 0.4), 0 0 16px rgba(37, 126, 104, 0.2)",
                  },
                },
              }}
            />
          )}
          {errors.language && (
            <Typography
              variant="caption"
              color="error"
              sx={{
                display: "block",
                marginTop: "1rem",
                textAlign: "left",
              }}
            >
              {errors.language}
            </Typography>
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
        "Prefer Not to Say",
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
            error={!!errors.ethnicity}
            sx={{
              backgroundColor: "var(--color-white)",
              width: "100%",
              height: "1.813rem",
              padding: "var(--spacing-0-1) 0.5rem",
              borderRadius: "5px",
              border: errors.ethnicity ? "1px solid red" : "1px solid black", //add conditional border
              marginTop: "0px",
            }}
          >
            {preDefinedOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
            <MenuItem value="Other">Other</MenuItem>
          </Select>
          {selectValue === "Other" && (
            <TextField
              name="ethnicity"
              placeholder="Enter ethnicity"
              value={isPredefined ? "" : clientProfile.ethnicity}
              onChange={handleEthnicityCustomChange}
              sx={{
                backgroundColor: "var(--color-white)",
                width: "100%",
                height: "1.813rem",
                padding: "var(--spacing-0-1) 0.5rem",
                borderRadius: "5px",
                marginTop: "0px",
              }}
            />
          )}
          {errors.ethnicity && (
            <Typography
              variant="caption"
              color="error"
              sx={{
                display: "block",
                marginTop: "1rem",
                textAlign: "left",
              }}
            >
              {errors.ethnicity}
            </Typography>
          )}
        </Box>
      );
    }

    if (fieldPath === "gender") {
      if (!isEditing) {
        return <Box>{clientProfile.gender}</Box>;
      }

      const preDefinedOptions = ["Male", "Female", "Other"];

      const isPredefined = preDefinedOptions.includes(clientProfile.gender);
      const selectValue = isPredefined ? clientProfile.gender : "Other";

      const handleGenderSelectChange = (e: any) => {
        const newVal = e.target.value;
        // Update with selected value
        handleChange({ target: { name: "gender", value: newVal } } as any);
      };

      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {" "}
          <Select
            name="gender"
            value={selectValue}
            onChange={handleGenderSelectChange}
            sx={{
              backgroundColor: "var(--color-white)",
              width: "100%",
              height: "1.813rem",
              padding: "var(--spacing-0-1) 0.5rem",
              borderRadius: "5px",
              border: ".1rem solid black",
              marginTop: "0px",
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                border: "2px solid var(--color-primary)",
                boxShadow: "0 0 8px rgba(37, 126, 104, 0.4), 0 0 16px rgba(37, 126, 104, 0.2)",
              },
            }}
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

      const preDefinedOptions = ["Adult", "Senior"];

      const isPredefined = preDefinedOptions.includes(clientProfile.headOfHousehold);
      const selectValue = isPredefined ? clientProfile.headOfHousehold : "Adult";

      const handleHeadOfHouseholdSelectChange = (e: any) => {
        const newVal = e.target.value;
        // Update with selected value
        handleChange({ target: { name: "headOfHousehold", value: newVal } } as any);
      };

      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Select
            name="headOfHousehold"
            value={selectValue}
            onChange={handleHeadOfHouseholdSelectChange}
            sx={{
              backgroundColor: "var(--color-white)",
              width: "100%",
              height: "1.813rem",
              padding: "var(--spacing-0-1) 0.5rem",
              borderRadius: "5px",
              border: ".1rem solid black",
              marginTop: "0px",
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                border: "2px solid var(--color-primary)",
                boxShadow: "0 0 8px rgba(37, 126, 104, 0.4), 0 0 16px rgba(37, 126, 104, 0.2)",
              },
            }}
          >
            {preDefinedOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
          {/* Add error display */}
          {errors.headOfHousehold && (
            <Typography
              variant="caption"
              color="error"
              sx={{
                display: "block",
                marginTop: "2px",
              }}
            >
              {errors.headOfHousehold}
            </Typography>
          )}
        </Box>
      );
    }

    if (fieldPath === "recurrence") {
      if (!isEditing) {
        return <Box>{clientProfile.recurrence}</Box>;
      }

      const preDefinedOptions = ["None", "Weekly", "2x-Monthly", "Monthly", "Periodic"];

      const isPredefined = preDefinedOptions.includes(clientProfile.recurrence);
      const selectValue = isPredefined ? clientProfile.recurrence : "None";

      const handleRecurrenceSelectChange = (e: any) => {
        const newVal = e.target.value;
        // Update with selected value
        handleChange({ target: { name: "recurrence", value: newVal } } as any);
      };

      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {" "}
          <Select
            name="recurrence"
            value={selectValue}
            onChange={handleRecurrenceSelectChange}
            sx={{
              backgroundColor: "var(--color-white)",
              width: "100%",
              height: "1.813rem",
              padding: "var(--spacing-0-1) 0.5rem",
              borderRadius: "5px",
              border: ".1rem solid black",
              marginTop: "0px",
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                border: "2px solid var(--color-primary)",
                boxShadow: "0 0 8px rgba(37, 126, 104, 0.4), 0 0 16px rgba(37, 126, 104, 0.2)",
              },
            }}
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
    const isDisabledField = ["city", "state", "zipCode", "quadrant", "ward", "total"].includes(
      fieldPath
    );

    return (
      <Box
        sx={{
          transition: "all 0.2s ease",
          "&:hover": {
            transform: isEditing ? "translateY(-2px)" : "none",
          },
        }}
      >
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
    } else if (text.trim() !== "") {
      updatedTags = [...tags, text.trim()];
    } else {
      return; // No change needed
    }

    // Update local state immediately
    setTags(updatedTags);

    // Update Firebase immediately if we have a client UID
    if (clientProfile.uid) {
      try {
        await setDoc(
          doc(db, dataSources.firebase.clientsCollection, clientProfile.uid),
          { tags: updatedTags },
          { merge: true }
        );

        // Also update the local clientProfile.tags to keep it in sync
        setClientProfile((prev) => ({
          ...prev,
          tags: updatedTags,
        }));
      } catch (error) {
        console.error("Error updating client tags in Firebase:", error);
        console.error("Client UID:", clientProfile.uid);
        console.error("Attempted tags update:", updatedTags);
        // Revert local state if Firebase update fails
        setTags(tags);
        alert(
          `Failed to update tags in Firebase: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    } else {
      console.warn("No client UID available, cannot update tags in Firebase");
    }
  };

  // Updated handler for dietary restrictions
  const handleDietaryRestrictionChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, type } = e.target;
    handlePrevClientCopying();

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setClientProfile((prevState) => ({
        ...prevState,
        deliveryDetails: {
          ...prevState.deliveryDetails,
          dietaryRestrictions: {
            ...prevState.deliveryDetails?.dietaryRestrictions,
            [name]: checked,
            ...(name === "other" && {
              other: checked,
              // Keep the existing otherText when checking, clear it when unchecking
              otherText: checked
                ? prevState.deliveryDetails?.dietaryRestrictions?.otherText || ""
                : "",
            }),
          },
        },
      }));
    } else if (
      (type === "text" || type === "textarea") &&
      (name === "otherText" || name === "allergiesText" || name === "dietaryPreferences")
    ) {
      const value = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
      setClientProfile((prevState) => ({
        ...prevState,
        deliveryDetails: {
          ...prevState.deliveryDetails,
          dietaryRestrictions: {
            ...prevState.deliveryDetails?.dietaryRestrictions,
            [name]: value,
            ...(name === "otherText" && { other: true }), // Ensure the checkbox stays checked when typing in otherText
            ...(name === "allergiesText" && { allergies: value.trim() !== "" }), // Checkbox checked if textbox not empty
          },
        },
      }));
    }
  };

  const handlePhysicalAilmentsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type } = e.target;
    handlePrevClientCopying();

    setClientProfile((prevState) => {
      if (type === "checkbox") {
        const { checked } = e.target;
        return {
          ...prevState,
          physicalAilments: {
            ...(prevState.physicalAilments || {}),
            [name]: checked,
            ...(name === "other" && {
              otherText: checked ? prevState.physicalAilments?.otherText || "" : "",
            }),
          },
        };
      }

      if (type === "text" && name === "otherText") {
        const value = e.target.value;
        return {
          ...prevState,
          physicalAilments: {
            ...(prevState.physicalAilments || {}),
            otherText: value,
            other: true,
          },
        };
      }
      return prevState; // fallback
    });
  };

  const handlePhysicalDisabilityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type } = e.target;
    handlePrevClientCopying();

    setClientProfile((prevState) => {
      if (type === "checkbox") {
        const { checked } = e.target;
        return {
          ...prevState,
          physicalDisability: {
            ...(prevState.physicalDisability || {}),
            [name]: checked,
            ...(name === "other" && {
              otherText: checked ? prevState.physicalDisability?.otherText || "" : "",
            }),
          },
        };
      }

      if (type === "text" && name === "otherText") {
        const value = e.target.value;
        return {
          ...prevState,
          physicalDisability: {
            ...(prevState.physicalDisability || {}),
            otherText: value,
            other: true,
          },
        };
      }
      return prevState; // fallback
    });
  };

  const handleMentalHealthConditionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type } = e.target;
    handlePrevClientCopying();

    setClientProfile((prevState) => {
      if (type === "checkbox") {
        const { checked } = e.target;
        return {
          ...prevState,
          mentalHealthConditions: {
            ...(prevState.mentalHealthConditions || {}),
            [name]: checked,
            ...(name === "other" && {
              otherText: checked ? prevState.mentalHealthConditions?.otherText || "" : "",
            }),
          },
        };
      }

      if (type === "text" && name === "otherText") {
        const value = e.target.value;
        return {
          ...prevState,
          mentalHealthConditions: {
            ...(prevState.mentalHealthConditions || {}),
            otherText: value,
            other: true,
          },
        };
      }
      return prevState; // fallback
    });
  };

  //google places autocomplete
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isGoogleApiLoaded, setIsGoogleApiLoaded] = useState(false);

  // Helper to load Google Maps script if not present
  function loadGoogleMapsScript(apiKey: string, callback: () => void) {
    if (typeof window.google === "object" && window.google.maps && window.google.maps.places) {
      callback();
      return;
    }
    const existingScript = document.getElementById("google-maps-script");
    if (existingScript) {
      existingScript.addEventListener("load", callback);
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = callback;
    document.body.appendChild(script);
  }

  // Load Google Maps API on mount
  useEffect(() => {
    loadGoogleMapsScript(googleMapsApiKey, () => setIsGoogleApiLoaded(true));
  }, []);

  // Initialize Google Places Autocomplete when input and API are ready
  useEffect(() => {
    if (
      isGoogleApiLoaded &&
      addressInputRef.current &&
      window.google &&
      window.google.maps &&
      window.google.maps.places
    ) {
      if (autocompleteRef.current) return; // Prevent re-initialization
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        addressInputRef.current,
        {
          types: ["address"],
          componentRestrictions: { country: "us" },
        }
      );
      autocompleteRef.current.addListener("place_changed", async () => {
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
        if (
          !quadrant &&
          place.formatted_address &&
          place.formatted_address.match(/(NW|NE|SW|SE)/i)
        ) {
          quadrant = place.formatted_address.match(/(NW|NE|SW|SE)/i)?.[0] || "";
        }

        // Get ward for the selected address
        let ward = "";
        try {
          const fullAddress = `${street.trim()}, ${city}, ${state} ${zip}`;
          ward = await getWard(fullAddress);
        } catch (error) {
          console.error("Error getting ward for selected address:", error);
          ward = "";
        }

        // Save only the street address in address field
        setClientProfile((prev) => ({
          ...prev,
          address: street.trim(),
          city,
          state,
          zipCode: zip,
          quadrant,
          ward,
        }));
        setIsAddressValidated(true);
      });
    }
  }, [isGoogleApiLoaded, isEditing]);

  // Debounced ward lookup for manually typed addresses
  useEffect(() => {
    if (!isEditing || !clientProfile.address) return;

    const timeoutId = setTimeout(async () => {
      // Only trigger ward lookup if the address is different from the previous one
      // and it's not empty
      if (clientProfile.address.trim() && clientProfile.address !== prevClientProfile?.address) {
        try {
          const ward = await getWard(clientProfile.address.trim());
          setClientProfile((prev) => ({
            ...prev,
            ward,
          }));
        } catch (error) {
          console.error("Error getting ward for manually typed address:", error);
        }
      }
    }, 1500); // Wait 1.5 seconds after user stops typing

    return () => clearTimeout(timeoutId);
  }, [clientProfile.address, isEditing, prevClientProfile?.address]);

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
        referredDate: CalendarUtils.toDayPilotString(TimeUtils.today()),
      }));
    } else {
      // If no case worker selected, remove the referral entity
      setClientProfile((prev) => {
        const newProfile = { ...prev };
        delete newProfile.referralEntity;
        delete newProfile.referredDate;
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
    // Prevent concurrent calls
    if (isProcessingDelivery) {
      return;
    }

    setIsProcessingDelivery(true);

    try {
      // 1. GET EXISTING DELIVERIES FROM DATABASE
      const eventsRef = collection(db, dataSources.firebase.calendarCollection);
      const q = query(eventsRef, where("clientId", "==", newDelivery.clientId));
      const querySnapshot = await getDocs(q);

      const existingDeliveries: DeliveryEvent[] = [];
      querySnapshot.forEach((doc) => {
        existingDeliveries.push({ id: doc.id, ...doc.data() } as DeliveryEvent);
      });

      const existingDates = new Set(
        existingDeliveries.map((event) =>
          new DayPilot.Date(toJSDate(event.deliveryDate)).toString("yyyy-MM-dd")
        )
      );

      // ...existing code...

      // 2. CALCULATE ALL DATES FOR THIS DELIVERY SERIES
      let allDates: Date[] = [];
      const recurrenceId = crypto.randomUUID();

      if (newDelivery.recurrence === "Custom") {
        allDates = newDelivery.customDates?.map((dateStr) => deliveryDate.toJSDate(dateStr)) || [];
      } else {
        const normalizedStart = deliveryDate.toJSDate(newDelivery.deliveryDate);
        allDates =
          newDelivery.recurrence === "None"
            ? [normalizedStart]
            : calculateRecurrenceDates(newDelivery).map((dateStr) =>
                deliveryDate.toJSDate(dateStr)
              );
      }

      // ...existing code...

      // 3. CHECK IF THIS IS ACTUALLY CHANGING AN END DATE (not just adding deliveries with an end date)
      // Only delete if the new end date is DIFFERENT from what already exists
      if (newDelivery.repeatsEndDate && existingDeliveries.length > 0) {
        // ...existing code...
        // Get existing end dates from the database
        const existingEndDates = [
          ...new Set(
            existingDeliveries.filter((d) => d.repeatsEndDate).map((d) => d.repeatsEndDate)
          ),
        ];

        // ...existing code...

        // Only delete if we're changing to a DIFFERENT end date
        const isDifferentEndDate =
          existingEndDates.length > 0 && !existingEndDates.includes(newDelivery.repeatsEndDate);

        if (isDifferentEndDate) {
          // ...existing code...
          const deletePromises: Promise<any>[] = [];

          // CONVERT NEW END DATE TO YYYY-MM-DD FORMAT FOR PROPER COMPARISON
          const newEndDateFormatted = deliveryDate.toISODateString(newDelivery.repeatsEndDate);
          const today = deliveryDate.toISODateString(new Date());

          // ...existing code...

          for (const event of existingDeliveries) {
            const eventDateStr = new DayPilot.Date(toJSDate(event.deliveryDate)).toString(
              "yyyy-MM-dd"
            );
            const isAfterEndDate = eventDateStr > newEndDateFormatted;
            const isFutureDate = eventDateStr >= today;

            // ...existing code...

            if (isAfterEndDate && isFutureDate) {
              // ...existing code...
              deletePromises.push(deleteDoc(doc(eventsRef, event.id)));
            } else {
              // ...existing code...
            }
          }

          if (deletePromises.length > 0) {
            await Promise.all(deletePromises);
          }
        } else {
          // ...existing code...
        }
      } else {
        // ...existing code...
      } // 4. SKIP EXISTING DATES, CREATE NEW DATES
      const newDates = allDates.filter((date) => {
        const dateStr = new DayPilot.Date(date).toString("yyyy-MM-dd");
        const exists = existingDates.has(dateStr);
        return !exists;
      });

      // CREATE NEW DELIVERIES
      if (newDates.length > 0) {
        const deliveryService = DeliveryService.getInstance();
        const createPromises = newDates.map((date) => {
          const eventToAdd: Partial<DeliveryEvent> = {
            clientId: newDelivery.clientId,
            clientName: newDelivery.clientName,
            deliveryDate: date,
            recurrence: newDelivery.recurrence,
            time: "",
            cluster: 0,
            recurrenceId: recurrenceId,
          };

          if (newDelivery.recurrence === "Custom") {
            eventToAdd.customDates = newDelivery.customDates;
          } else if (newDelivery.repeatsEndDate) {
            eventToAdd.repeatsEndDate = newDelivery.repeatsEndDate;
          }

          return deliveryService.createEvent(eventToAdd);
        });

        await Promise.all(createPromises);
      }

      // 5. REFRESH DATA AND SET LAST DELIVERY DATE TO MATCH MODAL END DATE
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Refresh delivery history
      if (clientId) {
        const deliveryService = DeliveryService.getInstance();
        const { pastDeliveries, futureDeliveries } =
          await deliveryService.getClientDeliveryHistory(clientId);
        setPastDeliveries(pastDeliveries);
        setFutureDeliveries(futureDeliveries);
        setEvents([...pastDeliveries, ...futureDeliveries]);

        // Set last delivery date to match modal's end date
        if (newDelivery.repeatsEndDate) {
          // If there's an end date in the modal, use that
          const formattedEndDate = deliveryDate
            .toJSDate(newDelivery.repeatsEndDate)
            .toLocaleDateString("en-US");
          setLastDeliveryDate(formattedEndDate);
        } else {
          // Otherwise, get the actual last delivery date
          const latestEndDateString = await getLastDeliveryDateForClient(clientId);
          setLastDeliveryDate(latestEndDateString || "No deliveries found");
        }
      }
    } catch (error) {
      console.error("Error adding delivery:", error);
    } finally {
      setIsProcessingDelivery(false);
    }
  };

  const fetchClients = async () => {
    try {
      // Use ClientService instead of direct Firebase calls
      // use imported singleton clientService directly
      const clientsData = await clientService.getAllClients();

      // Map client data to Client type with explicit type casting for compatibility
      const clientList = clientsData.clients.map((data: ClientProfile) => {
        // Ensure dietaryRestrictions has all required fields
        const dietaryRestrictions = data.deliveryDetails?.dietaryRestrictions || {};

        return {
          id: data.uid,
          uid: data.uid,
          // Preserve original casing, only trim whitespace
          firstName: (data.firstName || "").trim(),
          lastName: (data.lastName || "").trim(),
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
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
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
    <Box
      className="profile-container"
      sx={{ backgroundColor: "var(--color-background-gray-light)", minHeight: "100vh", pb: 4 }}
    >
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
      {showSimilarNamesInfo && <PopUp message={similarNamesMessage} duration={8000} />}
      {/* Spacer for navbar height */}
      <Box sx={{ height: "64px" }} />
      {/* Enhanced Profile Header */}
      <ProfileHeader
        firstName={clientProfile.firstName}
        lastName={clientProfile.lastName}
        isEditing={isEditing}
        tags={tags}
        allTags={allTags || []}
        handleTag={handleTag}
        clientId={clientProfile.uid || null}
        activeStatus={clientProfile.activeStatus}
      />
      <Box className="profile-main" sx={{ p: 2 }}>
        <Box
          className="centered-box"
          sx={{
            width: { xs: "95%", sm: "90%", md: "85%", lg: "75%" },
            maxWidth: "1200px",
            bgcolor: "var(--color-transparent)",
            boxShadow: "none",
            p: 0,
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
                justifyContent: "flex-start",
              }}
            >
              <SectionTitle sx={{ textAlign: "left", width: "100%" }}>
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
                    disabled={isSaving}
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
              addressError={addressError}
              addressInputRef={addressInputRef}
            />
          </SectionBox>

          {/* Delivery Information Section */}
          <SectionBox mb={3}>
            <SectionTitle sx={{ textAlign: "left", width: "100%" }}>
              Delivery Information
            </SectionTitle>
            <DeliveryInfoForm
              isEditing={isEditing}
              clientProfile={clientProfile}
              fieldLabelStyles={fieldLabelStyles}
              renderField={renderField}
              lastDeliveryDate={lastDeliveryDate}
              isSaved={isSaved}
              isNewProfile={isNewProfile}
            />
          </SectionBox>

          {/* Delivery Log Section */}
          <SectionBox mb={3}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
              }}
            >
              <SectionTitle sx={{ textAlign: "left", width: "100%" }}>Deliveries</SectionTitle>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={async () => {
                  // Refresh delivery data before opening modal
                  if (clientId) {
                    const deliveryService = DeliveryService.getInstance();
                    try {
                      const { pastDeliveries, futureDeliveries } =
                        await deliveryService.getClientDeliveryHistory(clientId);
                      setPastDeliveries(pastDeliveries);
                      setFutureDeliveries(futureDeliveries);

                      // Find the latest recurring delivery
                      const allDeliveries = [...pastDeliveries, ...futureDeliveries];

                      const recurringDeliveries = allDeliveries.filter(
                        (delivery) => delivery.recurrence && delivery.recurrence !== "None"
                      );

                      if (recurringDeliveries.length > 0) {
                        const sortedRecurring = recurringDeliveries.sort((a, b) => {
                          const dateA = toJSDate(a.deliveryDate);
                          const dateB = toJSDate(b.deliveryDate);
                          return dateB.getTime() - dateA.getTime();
                        });
                        setLatestRecurringDelivery(sortedRecurring[0]);
                      } else {
                        setLatestRecurringDelivery(null);
                      }
                    } catch (error) {
                      console.error("Failed to refresh delivery history", error);
                    }
                  }
                  setIsDeliveryModalOpen(true);
                }}
                disabled={userRole === UserType.ClientIntake}
                sx={{
                  marginRight: 4,
                  width: 166,
                  color: "var(--color-background-main)",
                  backgroundColor: "var(--color-primary)",
                }}
              >
                Add Delivery
              </Button>
            </Box>
            <AddDeliveryDialog
              open={isDeliveryModalOpen}
              onClose={() => setIsDeliveryModalOpen(false)}
              onAddDelivery={handleAddDelivery}
              clients={[]}
              startDate={new DayPilot.Date()}
              preSelectedClient={preSelectedClientData}
            />
            <DeliveryLogForm
              pastDeliveries={pastDeliveries}
              futureDeliveries={futureDeliveries}
              fieldLabelStyles={fieldLabelStyles}
              onDeleteDelivery={async (delivery: DeliveryEvent) => {
                try {
                  // Update the parent component's state to reflect the deletion
                  // Note: Firestore deletion is already handled by DeliveryLogForm
                  const updatedFutureDeliveries = futureDeliveries.filter(
                    (d) => d.id !== delivery.id
                  );
                  setFutureDeliveries(updatedFutureDeliveries);

                  // Also refresh the delivery history to ensure consistency
                  if (clientId) {
                    const deliveryService = DeliveryService.getInstance();
                    const { futureDeliveries: refreshedFutureDeliveries } =
                      await deliveryService.getClientDeliveryHistory(clientId);
                    setFutureDeliveries(refreshedFutureDeliveries);
                  }
                } catch (error) {
                  console.error("Error updating delivery state after deletion:", error);
                }
              }}
            />
          </SectionBox>

          {/* Dietary Preferences Section */}
          <SectionBox mb={3}>
            <SectionTitle sx={{ textAlign: "left", width: "100%" }}>Dietary Options</SectionTitle>
            <DietaryPreferencesForm
              isEditing={isEditing}
              fieldLabelStyles={fieldLabelStyles}
              dietaryRestrictions={clientProfile.deliveryDetails?.dietaryRestrictions || {}}
              renderField={renderField}
            />
          </SectionBox>

          {/*Health Section*/}
          <SectionBox mb={3}>
            <SectionTitle sx={{ textAlign: "left", width: "100%" }}>Health Conditions</SectionTitle>
            <HealthConditionsForm
              isEditing={isEditing}
              fieldLabelStyles={fieldLabelStyles}
              dietaryRestrictions={clientProfile.deliveryDetails?.dietaryRestrictions || {}}
              renderField={renderField}
            />
          </SectionBox>

          {/* Miscellaneous Section */}
          <SectionBox>
            <SectionTitle sx={{ textAlign: "left", width: "100%" }}>
              Miscellaneous Information
            </SectionTitle>
            <MiscellaneousForm
              clientProfile={clientProfile}
              isEditing={isEditing}
              renderField={renderField}
              configFields={configFields}
              fieldValues={dynamicFields}
              handleFieldChange={(key, value) =>
                setDynamicFields((prev) => ({ ...prev, [key]: value }))
              }
            />{" "}
          </SectionBox>
          <SectionBox sx={{ textAlign: "right", width: "100%" }}>
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
                  disabled={isSaving}
                  aria-label="save"
                  size="small"
                >
                  <SaveIcon />
                </StyledIconButton>
              )}
            </Box>
          </SectionBox>
        </Box>{" "}
        {/* End centered-box */}
      </Box>{" "}
      {/* End profile-main */}
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
