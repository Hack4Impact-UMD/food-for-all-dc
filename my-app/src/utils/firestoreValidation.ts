import { isValidEmail, isValidPhone } from "./validation";
import { ClientProfile, Driver, DeliveryEvent, AuthUserRow } from "../types";
import { Cluster } from "../pages/Delivery/types/deliveryTypes";

export function validateClientProfile(data: unknown): data is ClientProfile {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    (typeof d.uid === "string" || typeof d.id === "string") &&
    typeof d.firstName === "string" &&
    typeof d.lastName === "string"
  );
}

export function validateDriver(data: unknown): data is Driver {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.id === "string" &&
    typeof d.name === "string" &&
    typeof d.phone === "string" &&
    isValidPhone(d.phone as string)
  );
}

export function validateDeliveryEvent(data: unknown): data is DeliveryEvent {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return typeof d.id === "string" && typeof d.clientId === "string";
}

export function validateCluster(data: unknown): data is Cluster {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return typeof d.id === "string" && Array.isArray(d.deliveries);
}

export function validateAuthUserRow(data: unknown): data is AuthUserRow {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.id === "string" &&
    typeof d.name === "string" &&
    typeof d.email === "string" &&
    isValidEmail(d.email as string)
  );
}
