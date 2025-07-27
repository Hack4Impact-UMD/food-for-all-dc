import { Timestamp } from "firebase/firestore";
import { ClientProfile, DeliveryDetails, DietaryRestrictions, CaseWorker } from '../../types';

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
  | "physicalAilments"
  | "physicalDisability"
  | "mentalHealthConditions"
  | "email";