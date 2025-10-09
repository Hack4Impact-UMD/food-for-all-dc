// Type definitions for client profiles and related entities

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
  heartFriendly: boolean;
  foodAllergens: string[];
  otherText: string;
  other: boolean;
  dietaryPreferences?: string;
  [key: string]: any;
}

export interface DeliveryDetails {
  deliveryInstructions: string;
  dietaryRestrictions: DietaryRestrictions;
}

export interface ClientProfile {
  famStartDate?: string | null;
  uid: string;
  firstName: string;
  lastName: string;
    miscellaneousDynamicFields?: { [key: string]: string };
  zipCode: string;
  address: string;
  address2: string;
  email: string;
  city: string;
  state: string;
  quadrant: string;
  dob: string;
  deliveryFreq: string;
  deliveries?: string[]
  phone: string;
  alternativePhone: string;
  referredDate?: string;
  adults: number;
  children: number;
  total: number;
  gender: "Male" | "Female" | "Other";
  ethnicity: string;
  deliveryDetails: {
    deliveryInstructions: string;
    dietaryRestrictions: DietaryRestrictions;
  };
  lifeChallenges: string;
  notes: string;
  notesTimestamp?: {
    notes: string;
    timestamp: Date;
  } | null;
  deliveryInstructionsTimestamp?: {
    notes: string;
    timestamp: Date;
  } | null;
  lifeChallengesTimestamp?: {
    notes: string;
    timestamp: Date;
  } | null;
  lifestyleGoalsTimestamp?: {
    notes: string;
    timestamp: Date;
  } | null;
  lifestyleGoals: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  ward: string;
  coordinates: { lat: number; lng: number }[];
  seniors: number;
  headOfHousehold: "Senior" | "Adult";
  referralEntity?: {
    id: string;
    name: string;
    organization: string;
  } | null;
  startDate: string;
  endDate: string;
  recurrence: string;
  tefapCert?: string;
  clusterID?: string;
  physicalAilments: {
    diabetes: boolean
    hypertension: boolean
    heartDisease: boolean
    kidneyDisease: boolean
    cancer: boolean
    otherText: string
    other: boolean
  };
  physicalDisability: {
    otherText: string
    other: boolean
  };
  mentalHealthConditions: {
    otherText: string
    other: boolean
  }
}