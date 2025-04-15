import { Timestamp } from "firebase/firestore";

export type DietaryRestrictions = {
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

export type DeliveryDetails = {
  deliveryInstructions: string;
  dietaryRestrictions: DietaryRestrictions;
};

export interface CaseWorker {
  id: string;
  name: string;
  organization: string;
  phone: string;
  email: string;
}

export interface ClientProfile {
  uid: string;
  firstName: string;
  lastName: string;
  streetName: string;
  zipCode: string;
  address: string;
  address2: string;
  email: string;
  city: string;
  state: string;
  quadrant: string;
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
  notesTimestamp?: {
    notes: string;
    timestamp: Date;
  } | null;
  lifestyleGoals: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  ward: string;
  seniors: number;
  headOfHousehold: "Senior" | "Adult";
  referralEntity?: {
    id: string;
    name: string;
    organization: string;
  };
  startDate: string;
  endDate: string;
  recurrence: string;
  tefapCert?: string;
}

// Type for all possible field paths including nested ones
export type NestedKeyOf<T> = {
  [K in keyof T]: T[K] extends object ? `${string & K}.${string & keyof T[K]}` : K;
}[keyof T];

// Create a type for all possible keys in ClientProfile, including nested paths
export type ClientProfileKey =
  | keyof ClientProfile
  | "deliveryDetails.dietaryRestrictions"
  | "deliveryDetails.deliveryInstructions"
  | "tefapCert";

export type InputType =
  | "text"
  | "tags"
  | "date"
  | "number"
  | "select"
  | "textarea"
  | "checkbox"
  | "dietaryRestrictions"
  | "email";