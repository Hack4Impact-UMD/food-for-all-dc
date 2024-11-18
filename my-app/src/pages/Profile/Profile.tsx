import React, { useState, useEffect } from "react";
import "./Profile.css";
import { Edit, ChevronDown, Save, Trash } from "lucide-react";
import { Icon } from "@iconify/react";
import { db } from "../../auth/firebaseConfig";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { ClientProfile } from "../../types/types";
import { useNavigate } from "react-router-dom";

const Profile = ({ uid }: { uid: string }) => {
  // #### STATE ####
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(
    null
  );
  const [editMode, setEditMode] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const navigate = useNavigate();

  // #### UTIL FUNCTIONS ####
  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const calculateAge = (dob: Date) => {
    const diff = Date.now() - dob.getTime();
    const ageDt = new Date(diff);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  // fetch client type from firebase, set default values if not found
  useEffect(() => {
    const fetchClientData = async () => {
      if (uid) {
        const docRef = doc(db, "clients", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setClientProfile({
            uid: data.uid || "",
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            address: data.address || "",
            dob: data.dob ? data.dob.toDate() : new Date(),
            deliveryFreq: data.deliveryFreq || "",
            phone: data.phone || "",
            alternativePhone: data.alternativePhone || "",
            adults: data.adults || 0,
            children: data.children || 0,
            total: (data.adults || 0) + (data.children || 0),
            gender: data.gender || "Male",
            ethnicity: data.ethnicity || "",
            deliveryDetails: data.deliveryDetails || {
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
            lifeChallenges: data.lifeChallenges || "",
            notes: data.notes || "",
            lifestyleGoals: data.lifestyleGoals || "",
            language: data.language || "",
            createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt ? data.updatedAt.toDate() : new Date(),
          });
        } else {
          console.log("Error fetching document: ", uid);
        }
      }
    };

    fetchClientData();
  }, [uid]);

  // #### HANDLERS ####

  // handle input field change
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    if (clientProfile) {
      if (name === "dob") {
        const dateValue = new Date(value);
        setClientProfile((prevState) => ({
          ...prevState!,
          dob: dateValue,
        }));
      } else if (name === "adults" || name === "children") {
        setClientProfile((prevState) => ({
          ...prevState!,
          [name]: Number(value),
        }));
      } else if (name === "phone" || name === "alternativePhone") {
        // Remove any non-numeric characters
        const numericValue = value.replace(/\D/g, "");
        setClientProfile((prevState) => ({
          ...prevState!,
          [name]: numericValue,
        }));
      } else {
        setClientProfile((prevState) => ({
          ...prevState!,
          [name]: value,
        }));
      }
    }
  };

  // handle dietary restriction checkbox change
  const handleDietaryRestrictionChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, checked } = e.target;
    setClientProfile((prevState) => {
      if (prevState) {
        return {
          ...prevState,
          deliveryDetails: {
            ...prevState.deliveryDetails,
            dietaryRestrictions: {
              ...prevState.deliveryDetails.dietaryRestrictions,
              [name]: checked,
            },
          },
        };
      } else {
        return prevState;
      }
    });
  };

  // handle save button click
  const handleSave = async () => {
    if (clientProfile) {
      // Validate required fields
      const newErrors: { [key: string]: string } = {};

      if (!clientProfile.firstName.trim()) {
        newErrors.firstName = "First Name is required";
      }
      if (!clientProfile.lastName.trim()) {
        newErrors.lastName = "Last Name is required";
      }
      if (!clientProfile.address.trim()) {
        newErrors.address = "Address is required";
      }
      if (!clientProfile.dob) {
        newErrors.dob = "Date of Birth is required";
      }
      if (!clientProfile.deliveryFreq.trim()) {
        newErrors.deliveryFreq = "Delivery Frequency is required";
      }
      if (!clientProfile.phone.trim()) {
        newErrors.phone = "Phone is required";
      }
      if (!clientProfile.gender.trim()) {
        newErrors.gender = "Gender is required";
      }
      if (!clientProfile.ethnicity.trim()) {
        newErrors.ethnicity = "Ethnicity is required";
      }
      if (!clientProfile.language.trim()) {
        newErrors.language = "Language is required";
      }
      if (clientProfile.adults === 0 && clientProfile.children === 0) {
        newErrors.total = "At least one adult or child is required";
      }

      // Validate phone number (7 digits, numeric only)
      if (!/^\d{7}$/.test(clientProfile.phone)) {
        newErrors.phone = "Phone number must be exactly 7 digits";
      }

      // Set errors if any
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return; // Do not proceed to save
      } else {
        setErrors({});
      }

      // Proceed to save
      try {
        const updatedClientProfile = {
          ...clientProfile,
          updatedAt: new Date(),
          total: clientProfile.adults + clientProfile.children,
        };
        const docRef = doc(db, "clients", uid);
        await setDoc(docRef, updatedClientProfile, { merge: true });
        console.log("Document updated with ID: ", uid);
        setEditMode(false);
      } catch (e) {
        console.error("Error updating document: ", e);
      }
    }
  };

  // handle delete button click
  const handleDelete = async () => {
    if (clientProfile) {
      const confirmDelete = window.confirm(
        `Are you sure you want to delete ${clientProfile.firstName} ${clientProfile.lastName}?`
      );

      if (confirmDelete) {
        try {
          const docRef = doc(db, "clients", uid);
          await deleteDoc(docRef);
          console.log(`Document with ID ${uid} deleted.`);
          navigate("/dashboard"); // redirect to dashboard after delete
        } catch (e) {
          console.error("Error deleting document: ", e);
        }
      }
    }
  };

  // if cannot retrieve uid from firebase, then show loading
  if (!clientProfile) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="profile-container">
        <div className="white-container">
          <header className="profile-header">
            <div className="menu-icon">&#9776;</div>
            <div className="buttons-together">
              <div className="dropdown-container">
                <button
                  className="header-button dropdown-button"
                  onClick={toggleDropdown}
                >
                  Calendar
                  <ChevronDown size={16} className="dropdown-icon" />
                </button>
                {dropdownOpen && (
                  <div className="dropdown-menu">
                    <button className="dropdown-item">Calendar</button>
                    <button className="dropdown-item">Page1</button>
                    <button className="dropdown-item">Page2</button>
                  </div>
                )}
              </div>
              <div className="settings-icon">&#9881;</div>
              <button className="header-button admin-button">
                Admin
                <div className="admin-profile-circle"></div>
              </button>
            </div>
          </header>
          <div className="profile-name">
            {clientProfile.firstName} {clientProfile.lastName}
          </div>
          <div className="buttons-together">
            <Icon
              className="green"
              icon="iconamoon:profile-fill"
              width="32"
              height="32"
            />
            <div className="overview-title">OVERVIEW</div>
          </div>
        </div>
      </div>

      <div className="profile-main">
        <div className="centered-box">
          <div className="box-header">
            <div className="basic-info-title">Basic Information</div>
            <div className="buttons-together">
              {/* Edit/Save Button */}
              <div className="action-label">
                <button
                  className="action-button"
                  onClick={() => {
                    if (editMode) {
                      handleSave();
                    } else {
                      setEditMode(true);
                    }
                  }}
                >
                  {editMode ? <Save size={24} /> : <Edit size={24} />}
                </button>
              </div>
              <p className="action-label">{editMode ? "Save" : "Edit"}</p>

              {/* Delete Button */}
              {!editMode && (
                <>
                  <div className="action-label">
                    <button className="action-button" onClick={handleDelete}>
                      <Trash size={24} />
                    </button>
                  </div>
                  <p className="action-label">Delete</p>
                </>
              )}
            </div>
          </div>

          <div className="info-grid">
            {/* First Name */}
            <div>
              <span className="info-category">
                First Name{" "}
                {editMode && <span className="required-asterisk">*</span>}
              </span>
              {editMode ? (
                <>
                  <input
                    type="text"
                    name="firstName"
                    value={clientProfile.firstName}
                    onChange={handleChange}
                  />
                  {errors.firstName && (
                    <span className="error-message">{errors.firstName}</span>
                  )}
                </>
              ) : (
                <span className="information">{clientProfile.firstName}</span>
              )}
            </div>

            {/* Last Name */}
            <div>
              <span className="info-category">
                Last Name{" "}
                {editMode && <span className="required-asterisk">*</span>}
              </span>
              {editMode ? (
                <>
                  <input
                    type="text"
                    name="lastName"
                    value={clientProfile.lastName}
                    onChange={handleChange}
                  />
                  {errors.lastName && (
                    <span className="error-message">{errors.lastName}</span>
                  )}
                </>
              ) : (
                <span className="information">{clientProfile.lastName}</span>
              )}
            </div>

            {/* Date of Birth */}
            <div>
              <span className="info-category">
                Date of Birth{" "}
                {editMode && <span className="required-asterisk">*</span>}
              </span>
              {editMode ? (
                <>
                  <input
                    type="date"
                    name="dob"
                    value={clientProfile.dob.toISOString().substr(0, 10)}
                    onChange={(e) => {
                      const dateValue = new Date(e.target.value);
                      setClientProfile((prevState) => ({
                        ...prevState!,
                        dob: dateValue,
                      }));
                    }}
                  />
                  {errors.dob && (
                    <span className="error-message">{errors.dob}</span>
                  )}
                </>
              ) : (
                <span className="information">
                  {clientProfile.dob.toLocaleDateString()} (Age{" "}
                  {calculateAge(clientProfile.dob)})
                </span>
              )}
            </div>

            {/* Address */}
            <div>
              <span className="info-category">
                Address{" "}
                {editMode && <span className="required-asterisk">*</span>}
              </span>
              {editMode ? (
                <>
                  <input
                    type="text"
                    name="address"
                    value={clientProfile.address}
                    onChange={handleChange}
                  />
                  {errors.address && (
                    <span className="error-message">{errors.address}</span>
                  )}
                </>
              ) : (
                <span className="information">{clientProfile.address}</span>
              )}
            </div>

            {/* Gender */}
            <div>
              <span className="info-category">
                Gender{" "}
                {editMode && <span className="required-asterisk">*</span>}
              </span>
              {editMode ? (
                <>
                  <select
                    name="gender"
                    value={clientProfile.gender}
                    onChange={handleChange}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.gender && (
                    <span className="error-message">{errors.gender}</span>
                  )}
                </>
              ) : (
                <span className="information">{clientProfile.gender}</span>
              )}
            </div>

            {/* Phone */}
            <div>
              <span className="info-category">
                Phone {editMode && <span className="required-asterisk">*</span>}
              </span>
              {editMode ? (
                <>
                  <input
                    type="text"
                    name="phone"
                    value={clientProfile.phone}
                    onChange={handleChange}
                  />
                  {errors.phone && (
                    <span className="error-message">{errors.phone}</span>
                  )}
                </>
              ) : (
                <span className="information">{clientProfile.phone}</span>
              )}
            </div>

            {/* Alternative Phone */}
            <div>
              <span className="info-category">Alternate Phone</span>
              {editMode ? (
                <input
                  type="text"
                  name="alternativePhone"
                  value={clientProfile.alternativePhone || ""}
                  onChange={handleChange}
                />
              ) : (
                <span className="information">
                  {clientProfile.alternativePhone || "N/A"}
                </span>
              )}
            </div>

            {/* Ethnicity */}
            <div>
              <span className="info-category">
                Ethnicity{" "}
                {editMode && <span className="required-asterisk">*</span>}
              </span>
              {editMode ? (
                <>
                  <input
                    type="text"
                    name="ethnicity"
                    value={clientProfile.ethnicity}
                    onChange={handleChange}
                  />
                  {errors.ethnicity && (
                    <span className="error-message">{errors.ethnicity}</span>
                  )}
                </>
              ) : (
                <span className="information">{clientProfile.ethnicity}</span>
              )}
            </div>

            {/* Adults */}
            <div>
              <span className="info-category">
                Adults{" "}
                {editMode && <span className="required-asterisk">*</span>}
              </span>
              {editMode ? (
                <>
                  <input
                    type="number"
                    name="adults"
                    value={clientProfile.adults}
                    onChange={handleChange}
                  />
                  {errors.total && (
                    <span className="error-message">{errors.total}</span>
                  )}
                </>
              ) : (
                <span className="information">{clientProfile.adults}</span>
              )}
            </div>

            {/* Children */}
            <div>
              <span className="info-category">
                Children{" "}
                {editMode && <span className="required-asterisk">*</span>}
              </span>
              {editMode ? (
                <>
                  <input
                    type="number"
                    name="children"
                    value={clientProfile.children}
                    onChange={handleChange}
                  />
                  {errors.total && (
                    <span className="error-message">{errors.total}</span>
                  )}
                </>
              ) : (
                <span className="information">{clientProfile.children}</span>
              )}
            </div>

            {/* Delivery Frequency */}
            <div>
              <span className="info-category">
                Delivery Frequency{" "}
                {editMode && <span className="required-asterisk">*</span>}
              </span>
              {editMode ? (
                <>
                  <input
                    type="text"
                    name="deliveryFreq"
                    value={clientProfile.deliveryFreq}
                    onChange={handleChange}
                  />
                  {errors.deliveryFreq && (
                    <span className="error-message">{errors.deliveryFreq}</span>
                  )}
                </>
              ) : (
                <span className="information">
                  {clientProfile.deliveryFreq}
                </span>
              )}
            </div>

            {/* Dietary Restrictions */}
            <div>
              <span className="info-category">Dietary Restrictions</span>
              {editMode ? (
                <div>
                  {Object.entries(
                    clientProfile.deliveryDetails.dietaryRestrictions
                  )
                    .filter(([key]) => typeof key === "string")
                    .map(([key, value]) => (
                      <label key={key}>
                        <input
                          type="checkbox"
                          name={key}
                          checked={value as boolean}
                          onChange={handleDietaryRestrictionChange}
                        />
                        {key}
                      </label>
                    ))}
                </div>
              ) : (
                <span className="information">
                  {Object.entries(
                    clientProfile.deliveryDetails.dietaryRestrictions
                  )
                    .filter(([_, value]) => value === true)
                    .map(([key]) => key)
                    .join(", ") || "None"}
                </span>
              )}
            </div>

            {/* Delivery Instructions */}
            <div>
              <span className="info-category">Delivery Instructions</span>
              {editMode ? (
                <textarea
                  name="deliveryInstructions"
                  value={
                    clientProfile.deliveryDetails.deliveryInstructions || ""
                  }
                  onChange={(e) => {
                    const { name, value } = e.target;
                    setClientProfile((prevState) => ({
                      ...prevState!,
                      deliveryDetails: {
                        ...prevState!.deliveryDetails,
                        [name]: value,
                      },
                    }));
                  }}
                />
              ) : (
                <span className="information">
                  {clientProfile.deliveryDetails.deliveryInstructions || "N/A"}
                </span>
              )}
            </div>

            {/* Notes */}
            <div>
              <span className="info-category">Notes</span>
              {editMode ? (
                <textarea
                  name="notes"
                  value={clientProfile.notes || ""}
                  onChange={handleChange}
                />
              ) : (
                <span className="information">
                  {clientProfile.notes || "N/A"}
                </span>
              )}
            </div>

            {/* Life Challenges */}
            <div>
              <span className="info-category">Life Challenges</span>
              {editMode ? (
                <textarea
                  name="lifeChallenges"
                  value={clientProfile.lifeChallenges || ""}
                  onChange={handleChange}
                />
              ) : (
                <span className="information">
                  {clientProfile.lifeChallenges || "N/A"}
                </span>
              )}
            </div>

            {/* Lifestyle Goals */}
            <div>
              <span className="info-category">Lifestyle Goals</span>
              {editMode ? (
                <textarea
                  name="lifestyleGoals"
                  value={clientProfile.lifestyleGoals || ""}
                  onChange={handleChange}
                />
              ) : (
                <span className="information">
                  {clientProfile.lifestyleGoals || "N/A"}
                </span>
              )}
            </div>

            {/* Language */}
            <div>
              <span className="info-category">
                Language{" "}
                {editMode && <span className="required-asterisk">*</span>}
              </span>
              {editMode ? (
                <>
                  <input
                    type="text"
                    name="language"
                    value={clientProfile.language}
                    onChange={handleChange}
                  />
                  {errors.language && (
                    <span className="error-message">{errors.language}</span>
                  )}
                </>
              ) : (
                <span className="information">{clientProfile.language}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
