// Centralized data transformation and validation for Firestore models
// Add more as needed for each model type

import { isValidEmail, isValidPhone, isValidCoordinate } from "./validation";
import { ClientProfile, Driver, DeliveryEvent, AuthUserRow } from "../types";
import { Cluster } from "../pages/Delivery/types/deliveryTypes";

export function validateClientProfile(data: any): data is ClientProfile {
  return (
    !!data &&
    typeof data.uid === "string" &&
    typeof data.name === "string" &&
    isValidEmail(data.email)
  );
}

export function validateDriver(data: any): data is Driver {
  return (
    !!data &&
    typeof data.id === "string" &&
    typeof data.name === "string" &&
    isValidPhone(data.phone)
  );
}

export function validateDeliveryEvent(data: any): data is DeliveryEvent {
  return !!data && typeof data.id === "string" && typeof data.clientId === "string";
}

export function validateCluster(data: any): data is Cluster {
  return !!data && typeof data.id === "string" && Array.isArray(data.deliveries);
}

export function validateAuthUserRow(data: any): data is AuthUserRow {
  return (
    !!data &&
    typeof data.id === "string" &&
    typeof data.name === "string" &&
    isValidEmail(data.email)
  );
}
