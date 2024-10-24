// ClientForm.tsx

import React, { useState, useEffect } from "react";
import {
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  FormControl,
  FormGroup,
  RadioGroup,
  Radio,
  Grid,
} from "@mui/material";
import { db } from "../../auth/firebaseConfig";
import { collection, doc, getDoc, setDoc } from "firebase/firestore";
import { ClientProfile } from "../../types/types";

interface ClientFormProps {
  uid?: string;
}

const initialState: ClientProfile = {
  uid: "",
  firstName: "",
  lastName: "",
  address: "",
  dob: new Date(),
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
};

const ClientForm: React.FC<ClientFormProps> = ({ uid }) => {
  const [clientProfile, setClientProfile] = useState<ClientProfile>({
    ...initialState,
  });

  // get client data if uid prop exists
  useEffect(() => {
    const fetchClientData = async () => {
      if (uid) {
        const docRef = doc(db, "clients", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setClientProfile({
            ...(data as ClientProfile),
            dob: data.dob.toDate(),
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate(),
          });
        } else {
          console.log("Error fetching document: ", uid);
        }
      }
    };

    fetchClientData();
  }, [uid]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === "dob") {
      const dateValue = new Date(value);
      setClientProfile((prevState) => ({
        ...prevState,
        [name]: dateValue,
      }));
    } else {
      setClientProfile((prevState) => ({
        ...prevState,
        [name]: value,
      }));
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setClientProfile((prevState) => ({
      ...prevState,
      [name]: Number(value),
    }));
  };

  const handleGenderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientProfile((prevState) => ({
      ...prevState,
      gender: e.target.value as "Male" | "Female" | "Other",
    }));
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting form...");

    const total = clientProfile.adults + clientProfile.children;
    const clientData: ClientProfile = {
      ...clientProfile,
      total,
      updatedAt: new Date(),
    };

    // if uid prop doesn't exsist, create new doc
    if (!uid) {
      clientData.createdAt = new Date();

      const collectionRef = collection(db, "clients");
      const docRef = doc(collectionRef); // generates new doc id and sets it as uid
      clientData.uid = docRef.id;

      try {
        await setDoc(docRef, clientData);
        console.log("Document written with ID: ", docRef.id);

        // reset form
        setClientProfile({ ...initialState });
      } catch (e) {
        console.error("Error adding document: ", e);
      }

      // else update existing doc
    } else {
      clientData.uid = uid;

      try {
        const docRef = doc(db, "clients", uid);
        await setDoc(docRef, clientData, { merge: true });
        console.log("Document updated with ID: ", uid);
      } catch (e) {
        console.error("Error updating document: ", e);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            label="First Name"
            name="firstName"
            value={clientProfile.firstName}
            onChange={handleChange}
            fullWidth
            required
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Last Name"
            name="lastName"
            value={clientProfile.lastName}
            onChange={handleChange}
            fullWidth
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Address"
            name="address"
            value={clientProfile.address}
            onChange={handleChange}
            fullWidth
            required
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Date of Birth"
            name="dob"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={
              clientProfile.dob
                ? clientProfile.dob.toISOString().substr(0, 10)
                : ""
            }
            onChange={handleChange}
            fullWidth
            required
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Delivery Frequency"
            name="deliveryFreq"
            value={clientProfile.deliveryFreq}
            onChange={handleChange}
            fullWidth
            required
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Phone"
            name="phone"
            value={clientProfile.phone}
            onChange={handleChange}
            fullWidth
            required
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Alternative Phone"
            name="alternativePhone"
            value={clientProfile.alternativePhone}
            onChange={handleChange}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Adults"
            name="adults"
            type="number"
            value={clientProfile.adults}
            onChange={handleNumberChange}
            fullWidth
            required
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Children"
            name="children"
            type="number"
            value={clientProfile.children}
            onChange={handleNumberChange}
            fullWidth
            required
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Total"
            name="total"
            type="number"
            value={clientProfile.adults + clientProfile.children}
            fullWidth
            disabled
          />
        </Grid>
        <Grid item xs={12}>
          <FormControl component="fieldset">
            <RadioGroup
              row
              aria-label="gender"
              name="gender"
              value={clientProfile.gender}
              onChange={handleGenderChange}
            >
              <FormControlLabel value="Male" control={<Radio />} label="Male" />
              <FormControlLabel
                value="Female"
                control={<Radio />}
                label="Female"
              />
              <FormControlLabel
                value="Other"
                control={<Radio />}
                label="Other"
              />
            </RadioGroup>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Ethnicity"
            name="ethnicity"
            value={clientProfile.ethnicity}
            onChange={handleChange}
            fullWidth
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Delivery Instructions"
            name="deliveryInstructions"
            value={clientProfile.deliveryDetails.deliveryInstructions}
            onChange={(e) => {
              const { name, value } = e.target;
              setClientProfile((prevState) => ({
                ...prevState,
                deliveryDetails: {
                  ...prevState.deliveryDetails,
                  [name]: value,
                },
              }));
            }}
            fullWidth
          />
        </Grid>
        <Grid item xs={12}>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={
                    clientProfile.deliveryDetails.dietaryRestrictions.lowSugar
                  }
                  onChange={handleDietaryRestrictionChange}
                  name="lowSugar"
                />
              }
              label="Low Sugar"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={
                    clientProfile.deliveryDetails.dietaryRestrictions
                      .kidneyFriendly
                  }
                  onChange={handleDietaryRestrictionChange}
                  name="kidneyFriendly"
                />
              }
              label="Kidney Friendly"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={
                    clientProfile.deliveryDetails.dietaryRestrictions.vegan
                  }
                  onChange={handleDietaryRestrictionChange}
                  name="vegan"
                />
              }
              label="Vegan"
            />
          </FormGroup>
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Life Challenges"
            name="lifeChallenges"
            value={clientProfile.lifeChallenges}
            onChange={handleChange}
            fullWidth
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Notes"
            name="notes"
            value={clientProfile.notes}
            onChange={handleChange}
            fullWidth
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Lifestyle Goals"
            name="lifestyleGoals"
            value={clientProfile.lifestyleGoals}
            onChange={handleChange}
            fullWidth
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Language"
            name="language"
            value={clientProfile.language}
            onChange={handleChange}
            fullWidth
            required
          />
        </Grid>
        <Grid item xs={12}>
          <Button type="submit" variant="contained" color="primary">
            {uid ? "Update" : "Submit"}
          </Button>
        </Grid>
      </Grid>
    </form>
  );
};

export default ClientForm;
