// Re-export types from other files
export * from './client-types';
export * from './user-types';
export * from './delivery-types';

export enum UserType {
  Admin = "Admin",
  Manager = "Manager",
  ClientIntake = "ClientIntake",
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
