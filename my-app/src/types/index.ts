// Re-export types from other files
export * from "./client-types";
export * from "./user-types";
export * from "./delivery-types";
export * from "./calendar-types";
export * from "./spreadsheet-types";

export enum UserType {
  Admin = "Admin",
  Manager = "Manager",
  ClientIntake = "ClientIntake",
  Driver = "Driver",
}

export const canCreateUserType = (currentUserType: UserType, newUserType: UserType): boolean => {
  switch (currentUserType) {
    case UserType.Admin:
      return [UserType.Admin, UserType.Manager, UserType.ClientIntake].includes(newUserType);
    case UserType.Manager:
      return newUserType === UserType.ClientIntake; // ADR Staff can only create SchoolStaff accounts.
    default:
      return false; // Other types don't have permission to create new accounts.
  }
};

// All specific interface types have been moved to their respective files:
// - client-types.ts: ClientProfile, DeliveryDetails, DietaryRestrictions
// - user-types.ts: CaseWorker and related interfaces
// - delivery-types.ts: Delivery, Route, Volunteer

export interface AuthUserRow {
  id: string; // Firestore doc id
  uid: string; // Auth uid (same as id, kept for parity with client grid)
  name: string; // Combined first and last name for simplicity, or keep separate?
  role: UserType; // Use the existing enum
  phone?: string;
  email: string;
  dietaryPreference?: string; // Dietary preference for spreadsheet custom column
}
