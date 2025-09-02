import { DeliveryDetails, DietaryRestrictions } from "../../../types";

export interface RowData {
  id: string;
  clientid: string;
  firstName: string;
  lastName: string;
  address: string;
  phone: string;
  tags?: string[];
  ward?: string;
  clusterID?: string;
  deliveryDetails: DeliveryDetails;
  ethnicity?: string;
  language?: string;
  dob?: string;
  gender?: string;
  zipCode?: string;
  streetName?: string;
  [key: string]: any; // Allow for dynamic property access
}

export interface DeliveryRowData {
  id: string;
  clientid: string;
  firstName: string;
  lastName: string;
  address: string;
  tags?: string[];
  ward?: string;
  clusterId: string;
  coordinates: { lat: number; lng: number }[];
  deliveryDetails: {
    deliveryInstructions: string;
    dietaryRestrictions: {
      foodAllergens: string[];
      halal: boolean;
      kidneyFriendly: boolean;
      lowSodium: boolean;
      lowSugar: boolean;
      microwaveOnly: boolean;
      noCookingEquipment: boolean;
      other: string[];
      softFood: boolean;
      vegan: boolean;
      vegetarian: boolean;
    };
  };
}

// Define a type for fields that can either be computed or direct keys of RowData
export type Field =
  | {
      key: "checkbox";
      label: "";
      type: "checkbox";
      compute?: never;
      width: string;
    }
  | {
      key: "fullname";
      label: "Client";
      type: "text";
      compute: (data: RowData) => string;
      width: string;
    }
  | {
      key: keyof Omit<RowData, "id" | "firstName" | "lastName" | "deliveryDetails">;
      label: string;
      type: string;
      compute?: never;
      width: string;
    }
  | {
      key: "tags";
      label: "Tags";
      type: "text";
      compute: (data: RowData) => string;
      width: string;
    }
  | {
      key: "assignedDriver";
      label: "Driver";
      type: "text";
      compute: (data: RowData, clusters: Cluster[], drivers: Driver[]) => string;
      width: string;
    }
  | {
      key: "assignedTime";
      label: "Time";
      type: "text";
      compute: (data: RowData, clusters: Cluster[]) => string;
      width: string;
    }
  | {
      key: "deliveryDetails.deliveryInstructions";
      label: "Instructions";
      type: "text";
      compute: (data: RowData) => string;
      width: string;
    }
  | {
      key: "phone";
      label: "Phone Number";
      type: "text";
      compute: (data: RowData) => string;
      width: string;
    };

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export type DriverOption = Driver | { id: "edit_list"; name: string; phone: ""; email: "" };

export interface Cluster {
  docId: string;
  id: number;
  driver: any;
  time: string;
  deliveries: any[];
}

export interface ValidationErrors {
  name?: string;
  phone?: string;
  email?: string;
}

export interface DriverFormProps {
  value: Omit<Driver, "id">;
  onChange: (field: keyof Omit<Driver, "id">, value: string) => void;
  errors: ValidationErrors;
  onClearError: (field: keyof ValidationErrors) => void;
}

export interface DeliveryEvent {
  id: string;
  assignedDriverId: string;
  assignedDriverName: string;
  clientId: string;
  clientName: string;
  deliveryDate: Date;
  time: string;
  recurrence: "None" | "Weekly" | "2x-Monthly" | "Monthly";
  repeatsEndOption?: "On" | "After";
  repeatsEndDate?: string;
  repeatsAfterOccurrences?: number;
}

// Define fields for table columns
export const fields: Field[] = [
  {
    key: "checkbox",
    label: "",
    type: "checkbox",
    width: "5%",
  },
  {
    key: "fullname",
    label: "Client",
    type: "text",
    compute: (data: RowData) => `${data.lastName}, ${data.firstName}`,
    width: "10%",
  },
  {
    key: "tags",
    label: "Tags",
    type: "text",
    compute: (data: RowData) => {
      const tags = data.tags || [];
      return tags.length > 0 ? tags.join(", ") : "None";
    },
    width: "10%",
  },
  { key: "clusterID", label: "Clusters", type: "text", width: "6%" },
  { key: "address", label: "Address", type: "text", width: "12%" },
  {
    key: "phone",
    label: "Phone Number",
    type: "text",
    compute: (data: RowData) => {
      const number = data.phone || "N/A";
      return number;
    },
    width: "12%",
  },
  { key: "ward", label: "Ward", type: "text", width: "10%" },
  {
    key: "assignedDriver",
    label: "Driver",
    type: "text",
    compute: (data: RowData, clusters: Cluster[], drivers: Driver[]) => {
      //case where user is not assigned a cluster
      if (!data.clusterID) return "No Cluster assigned";

      //find cluster from cluster id
      const cluster = clusters.find((c) => c.id.toString() === data.clusterID);
      if (!cluster) return "No Cluster Found";

      //check to make sure driver exists
      if (!cluster.driver) return "No Driver Assigned";

      //find driver name from driver ref
      if (typeof cluster.driver === "object" && cluster.driver.id) {
        const driverId = cluster.driver.id;
        const driver = drivers.find((d) => d.id === driverId);
        return driver ? driver.name : "Driver Not Found";
      }

      return "Driver Not Found";
    },
    width: "10%",
  },
  {
    key: "assignedTime",
    label: "Time",
    type: "text",
    compute: (data: RowData, clusters: Cluster[]) => {
      //case where user is not assigned a cluster
      if (!data.clusterID) return "No Cluster assigned";

      //find cluster from cluster id
      const cluster = clusters.find((c) => c.id.toString() === data.clusterID);
      if (!cluster) return "No Cluster Found";

      //check to make sure driver exists
      if (cluster.time) {
        const toStandardArr = cluster.time.split(":");
        let hours = Number(toStandardArr[0]);
        const mins = Number(toStandardArr[1]);
        let ampm = "";
        if (hours < 12) {
          hours = hours === 0 ? 12 : hours;
          ampm = "AM";
        } else {
          hours = hours === 12 ? 12 : hours % 12;
          ampm = "PM";
        }
        return `${hours}:${mins < 10 ? "0" : ""}${mins} ${ampm}`;
      } else {
        return "No Time Assigned";
      }
    },
    width: "10%",
  },
  {
    key: "deliveryDetails.deliveryInstructions",
    label: "Instructions",
    type: "text",
    compute: (data: RowData) => {
      const instructions = data.deliveryDetails.deliveryInstructions || "";
      return instructions;
    },
    width: "15%",
  },
];

// ADDED
export interface CustomColumn {
  id: string; // Unique identifier for the column
  label: string; // Header label (e.g., "Custom 1", or user-defined)
  propertyKey: keyof RowData | "none"; // Which property from RowData to display
}

// Type Guard to check if a field is a regular field
export const isRegularField = (field: Field): field is Extract<Field, { key: keyof RowData }> => {
  return (
    field.key !== "fullname" &&
    field.key !== "tags" &&
    field.key !== "assignedDriver" &&
    field.key !== "assignedTime" &&
    field.key !== "phone" &&
    field.key !== "deliveryDetails.deliveryInstructions"
  );
};
