import { CsvRow, downloadCsv } from "../../utils/csvExport";
import { getNestedValue } from "../../utils/misc";
import { formatDietaryRestrictionsForExport } from "../../utils/exportFormatters";
import type { ClientServiceStatus } from "../../types/client-types";

export interface RowData {
  id: string;
  clientid?: string;
  uid: string;
  firstName: string;
  lastName: string;
  phone?: string;
  houseNumber?: number;
  address: string;
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
      otherText: string;
      other: boolean;
      softFood: boolean;
      vegan: boolean;
      heartFriendly: boolean;
      vegetarian: boolean;
      dietaryPreferences?: string;
    };
  };
  ethnicity: string;
  // Additional fields that can be used in custom columns
  adults?: number;
  children?: number;
  deliveryFreq?: string;
  gender?: string;
  language?: string;
  notes?: string;
  referralEntity?: {
    name: string;
    organization: string;
  };
  tefapCert?: string;
  tags?: string[];
  dob?: string;
  ward?: string;
  streetName?: string;
  zipCode?: string;
  clusterID?: string;
  address2?: string;
  lastDeliveryDate?: string;
  clientStatus?: ClientServiceStatus;
  activeStatus?: boolean;
  startDate?: string;
  endDate?: string;
}

// Allow dynamic property access for RowData
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface RowData {
  [key: string]: any;
}

/**
 * Export visible columns as a CSV file.
 * @param rows - The data to export.
 * @param customColumns - The custom columns currently visible in the table.
 */
const getSpreadsheetExportColumnHeader = (propertyKey: string): string => {
  switch (propertyKey) {
    case "adults":
      return "Adults";
    case "children":
      return "Children";
    case "deliveryFreq":
      return "Delivery Frequency";
    case "deliveryDetails.dietaryRestrictions":
      return "Dietary Restrictions";
    case "deliveryDetails.dietaryRestrictions.dietaryPreferences":
      return "Dietary Preferences";
    case "ethnicity":
      return "Ethnicity";
    case "gender":
      return "Gender";
    case "language":
      return "Language";
    case "notes":
      return "Notes";
    case "phone":
      return "Phone";
    case "referralEntity":
      return "Referral Entity";
    case "tefapCert":
      return "TEFAP Cert";
    case "tags":
      return "Tags";
    case "dob":
      return "Date of Birth";
    case "ward":
      return "Ward";
    case "lastDeliveryDate":
      return "Last Delivery Date";
    default:
      return propertyKey.charAt(0).toUpperCase() + propertyKey.slice(1);
  }
};

const resolveSpreadsheetExportValue = (row: RowData, propertyKey: string): string => {
  if (propertyKey === "deliveryDetails.dietaryRestrictions") {
    return formatDietaryRestrictionsForExport(row.deliveryDetails?.dietaryRestrictions);
  }

  if (propertyKey === "referralEntity") {
    const referralEntity = row.referralEntity;
    return referralEntity
      ? [referralEntity.name, referralEntity.organization].filter(Boolean).join(", ")
      : "";
  }

  if (propertyKey === "lastDeliveryDate") {
    return typeof row.lastDeliveryDate === "string" ? row.lastDeliveryDate : "";
  }

  const value = propertyKey.includes(".") ? getNestedValue(row, propertyKey, "") : row[propertyKey];
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    if ("name" in value || "organization" in value) {
      return [value.name, value.organization].filter(Boolean).join(", ");
    }

    return "";
  }

  return String(value);
};

export const exportQueryResults = (
  rows: RowData[],
  customColumns: Array<{ id: string; label: string; propertyKey: string }> = []
) => {
  const visibleData: CsvRow[] = rows.map((row) => {
    // Start with the base columns that are always visible
    const baseData: CsvRow = {
      Name: `${row.lastName}, ${row.firstName}`,
      Address: row.address,
      "Address 2": row.address2 || "",
      Phone: row.phone ?? "",
      "Delivery Instructions": row.deliveryDetails?.deliveryInstructions || "None",
      "Dietary Restrictions": formatDietaryRestrictionsForExport(
        row.deliveryDetails?.dietaryRestrictions
      ),
    };

    // Add custom columns that are configured (not "none")
    customColumns.forEach((col) => {
      if (col.propertyKey !== "none") {
        const columnLabel = getSpreadsheetExportColumnHeader(col.propertyKey);
        baseData[columnLabel] = resolveSpreadsheetExportValue(row, col.propertyKey);
      }
    });

    return baseData;
  });

  return downloadCsv(visibleData, "query_results.csv");
};

/**
 * Export all data as a CSV file with formatted, readable output.
 * @param rows - The data to export.
 */
export const exportAllClients = (rows: RowData[]) => {
  const formattedData: CsvRow[] = rows.map((row) => {
    // Format the data in a readable way
    return {
      UID: row.uid,
      Name: `${row.lastName}, ${row.firstName}`,
      Phone: row.phone ?? "",
      Address: row.address,
      "Address 2": row.address2 || "",
      "House Number": row.houseNumber ?? "",
      "Street Name": row.streetName ?? "",
      "Zip Code": row.zipCode ?? "",
      Ward: row.ward ?? "",
      "Cluster ID": row.clusterID ?? "",
      "Delivery Instructions": row.deliveryDetails?.deliveryInstructions || "None",
      "Dietary Restrictions": formatDietaryRestrictionsForExport(
        row.deliveryDetails?.dietaryRestrictions
      ),
      "Food Allergens": row.deliveryDetails?.dietaryRestrictions?.foodAllergens?.join(", ") || "",
      Ethnicity: row.ethnicity ?? "",
      Adults: row.adults ?? "",
      Children: row.children ?? "",
      "Delivery Frequency": row.deliveryFreq ?? "",
      Gender: row.gender ?? "",
      Language: row.language ?? "",
      Notes: row.notes ?? "",
      "Referral Entity": row.referralEntity
        ? [row.referralEntity.name, row.referralEntity.organization].filter(Boolean).join(", ")
        : "",
      "TEFAP Cert": row.tefapCert ?? "",
      Tags: row.tags?.join(", ") || "",
      "Date of Birth": row.dob ?? "",
    };
  });

  return downloadCsv(formattedData, "all_clients.csv");
};
