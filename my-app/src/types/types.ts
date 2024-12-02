import { StringLiteral } from "typescript";

type Role = "Admin" | "Manager" | "Volunteer";

interface User {
  id: string; // Firebase document ID
  email: string;
  name: string;
  role: Role;
}

export interface ClientProfile {
  uid: string;
  firstName: string;
  lastName: string;
  address: string;
  houseNumber: string;
  streetName: string;
  zipCode: string;
  dob: Date; // Date of birth
  deliveryFreq: string;
  phone: string;
  alternativePhone?: string; // Optional
  adults: number;
  children: number;
  total: number; // Adults + Children
  gender: "Male" | "Female" | "Other";
  ethnicity: string;
  deliveryDetails: DeliveryDetails;
  lifeChallenges?: string; // Optional
  notes?: string; // Optional
  lifestyleGoals?: string; // Optional
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryDetails {
  deliveryInstructions?: string; // Optional
  dietaryRestrictions: DietaryRestrictions;
}

export interface DietaryRestrictions {
  lowSugar: boolean;
  kidneyFriendly: boolean;
  vegan: boolean;
  vegetarian: boolean;
  halal: boolean;
  microwaveOnly: boolean;
  softFood: boolean;
  lowSodium: boolean;
  noCookingEquipment: boolean;
  foodAllergens?: string[]; // Optional: Example values ['nuts', 'dairy']
  other?: string[]; // Optional: Example values ['No red meat', etc.]
}

export interface Delivery {
  id: string; //delivery id
  day: Date;
  clientID: string;
  driver: Volunteer;
  status: "Delivered" | "Not Delivered";
  notes?: string; // Optional
}

export interface Route {
  volunteer: Volunteer;
  deliveries: Delivery[];
}

export interface Volunteer {
  id: string;
  name: string;
  phone: string;
}
