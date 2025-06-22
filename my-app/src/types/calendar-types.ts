import { DayPilot } from "@daypilot/daypilot-lite-react";
import { ClientProfile } from "./client-types";
import { Delivery } from "./delivery-types";

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export interface DateLimit {
  id: string;
  date: string;
  limit: number;
}

// Extending Delivery for calendar-specific fields
export interface DeliveryEvent extends Delivery {
  recurrence: "None" | "Weekly" | "2x-Monthly" | "Monthly" | "Custom";
  customDates?: string[];
  recurrenceId: string;
  seriesStartDate?: string; // The original start date of a recurring series
}

export interface NewDelivery {
  assignedDriverId?: string;
  assignedDriverName?: string;
  clientId: string;
  clientName: string;
  deliveryDate: string; // ISO string for the delivery date
  recurrence: "None" | "Weekly" | "2x-Monthly" | "Monthly" | "Custom";
  repeatsEndDate?: string;
  customDates?: string[];
  seriesStartDate?: string; // The original start date of a recurring series
}

export type ViewType = "Day" | "Month";
export type DayPilotViewType = "Day" | "Days" | "WorkWeek" | "Resources";

export interface CalendarEvent {
  id: string;
  text: string;
  start: DayPilot.Date;
  end: DayPilot.Date;
  backColor: string;
}

export interface CalendarConfig {
  viewType: DayPilotViewType | ViewType;
  startDate: DayPilot.Date;
  events: CalendarEvent[];
} 