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
  foodAllergens: string[];
  other: string[];
}

export interface DeliveryDetails {
  deliveryInstructions: string;
  dietaryRestrictions: DietaryRestrictions;
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