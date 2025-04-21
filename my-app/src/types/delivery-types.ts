// Type definitions for deliveries, routes, and related entities

export interface Volunteer {
  id: string;
  name: string;
  phone: string;
}

export interface Delivery {
  id: string;
  assignedDriverId: string;
  assignedDriverName: string;
  clientId: string;
  clientName: string;
  deliveryDate: Date; // The date of the delivery
  time: string; // The time of the delivery;
  cluster: number;
  recurrence: "None" | "Weekly" | "2x-Monthly" | "Monthly" | "Custom"; // Updated recurrence options
  repeatsEndDate?: string; // Optional, end date for recurrence
}

export interface Route {
  volunteer: Volunteer;
  deliveries: Delivery[];
} 