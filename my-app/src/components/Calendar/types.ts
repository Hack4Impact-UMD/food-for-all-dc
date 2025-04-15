import { DayPilot } from "@daypilot/daypilot-lite-react";

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Client {
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
    notes: string;
    timestamp: Date;
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
}

export interface DateLimit {
  id: string;
  date: string;
  limit: number;
}

export interface DeliveryDetails {
  deliveryInstructions: string;
  dietaryRestrictions: DietaryRestrictions;
}

export interface DietaryRestrictions {
  foodAllergens: Array<boolean>;
  other: Array<boolean>;
  halal: boolean;
  kidneyFriendly: boolean;
  lowSodium: boolean;
  lowSugar: boolean;
  microwaveOnly: boolean;
  noCookingEquipment: boolean;
  softFood: boolean;
  vegan: boolean;
  vegeterian: boolean;
}

export interface DeliveryEvent {
  id: string;
  assignedDriverId: string;
  assignedDriverName: string;
  clientId: string;
  clientName: string;
  deliveryDate: Date; // The date of the delivery
  time: string; // The time of the delivery;
  cluster: number;
  recurrence: "None" | "Weekly" | "2x-Monthly" | "Monthly"; // Updated recurrence options
  repeatsEndDate?: string; // Optional, end date for recurrence
}

export interface NewDelivery {
  assignedDriverId: string;
  assignedDriverName: string;
  clientId: string;
  clientName: string;
  deliveryDate: string; // ISO string for the delivery date
  recurrence: "None" | "Weekly" | "2x-Monthly" | "Monthly"; // Updated recurrence options
  repeatsEndDate?: string; // Optional, end date for recurrence
}

export type ViewType = "Day" | "Month";
export type DayPilotViewType = "Day" | "Days" | "WorkWeek" | "Resources";

// Add interface for calendar events
export interface CalendarEvent {
  id: string;
  text: string;
  start: DayPilot.Date;
  end: DayPilot.Date;
  backColor: string;
}

// Add interface for calendar configuration
export interface CalendarConfig {
  viewType: DayPilotViewType | ViewType;
  startDate: DayPilot.Date;
  events: CalendarEvent[];
}