// Type definitions for deliveries, routes, and related entities

export interface Volunteer {
  id: string;
  name: string;
  phone: string;
}

export interface Delivery {
  id: string; //delivery id
  day: Date;
  clientID: string;
  driver: Volunteer;
  status: "Delivered" | "Not Delivered";
  notes?: string; // Optional
}

export interface Route {
  volunteer: Volunteer;
  deliveries: Delivery[];
} 