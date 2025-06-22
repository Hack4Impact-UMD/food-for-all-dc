// Export configuration settings
// This file contains configurable values for export functionality to avoid hardcoding

export interface OrganizationConfig {
  name: string;
  abbreviation: string;
  phone: string;
  pickupInstructions: string;
}

export interface DoorDashConfig {
  pickupLocationId: string;
  timezone: string;
  defaultCity: string;
  defaultState: string;
  numberOfItems: string;
  orderVolume: string;
  deliveryWindowHours: number; // Duration of delivery window in hours
  maxInstructionLength: number; // Max characters for delivery instructions
}

export interface ExportConfig {
  organization: OrganizationConfig;
  doorDash: DoorDashConfig;
  fileNamePrefix: string;
}

// Default configuration - can be overridden by environment variables or database settings
export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  organization: {
    name: "Food For All DC",
    abbreviation: "FFA",
    phone: "2024898676",
    pickupInstructions: "Go to back door in alley at the back of church"
  },
  doorDash: {
    pickupLocationId: "ANANDAMARGA-01",
    timezone: "US/Eastern",
    defaultCity: "Washington",
    defaultState: "DC",
    numberOfItems: "1",
    orderVolume: "",
    deliveryWindowHours: 1,
    maxInstructionLength: 250
  },
  fileNamePrefix: "FFA"
};

// Function to get export configuration
// This can be extended to load from environment variables, database, or other sources
export const getExportConfig = (): ExportConfig => {
  // For now, return default config
  // In the future, this could check environment variables or fetch from database
  return {
    ...DEFAULT_EXPORT_CONFIG,
    // Override with environment variables if available
    organization: {
      ...DEFAULT_EXPORT_CONFIG.organization,
      name: process.env.REACT_APP_ORG_NAME || DEFAULT_EXPORT_CONFIG.organization.name,
      phone: process.env.REACT_APP_ORG_PHONE || DEFAULT_EXPORT_CONFIG.organization.phone,
      pickupInstructions: process.env.REACT_APP_PICKUP_INSTRUCTIONS || DEFAULT_EXPORT_CONFIG.organization.pickupInstructions
    },
    doorDash: {
      ...DEFAULT_EXPORT_CONFIG.doorDash,
      pickupLocationId: process.env.REACT_APP_DOORDASH_PICKUP_ID || DEFAULT_EXPORT_CONFIG.doorDash.pickupLocationId,
      timezone: process.env.REACT_APP_TIMEZONE || DEFAULT_EXPORT_CONFIG.doorDash.timezone,
      defaultCity: process.env.REACT_APP_DEFAULT_CITY || DEFAULT_EXPORT_CONFIG.doorDash.defaultCity,
      defaultState: process.env.REACT_APP_DEFAULT_STATE || DEFAULT_EXPORT_CONFIG.doorDash.defaultState
    }
  };
}; 