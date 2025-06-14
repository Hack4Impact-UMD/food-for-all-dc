import Papa from "papaparse";
import { saveAs } from "file-saver";

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
}

/**
 * Export visible columns as a CSV file.
 * @param rows - The data to export.
 * @param customColumns - The custom columns currently visible in the table.
 */
export const exportQueryResults = (rows: RowData[], customColumns: Array<{id: string, label: string, propertyKey: string}> = []) => {
    const visibleData = rows.map((row) => {
        // Start with the base columns that are always visible
        const baseData: Record<string, any> = {
            Name: `${row.lastName}, ${row.firstName}`,
            Address: row.address,
            Phone: (row as any).phone || "N/A",
            "Delivery Instructions": row.deliveryDetails?.deliveryInstructions || "None",
            "Dietary Restrictions": row.deliveryDetails?.dietaryRestrictions
                ? Object.entries(row.deliveryDetails.dietaryRestrictions)
                    .filter(([key, value]) => value === true || (Array.isArray(value) && value.length > 0))
                    .map(([key]) => key)
                    .join(", ")
                : "None",
        };

        // Add custom columns that are configured (not "none")
        customColumns.forEach((col) => {
            if (col.propertyKey !== "none") {
                // Use a more meaningful column header based on the property key
                const getColumnHeader = (propertyKey: string): string => {
                    switch (propertyKey) {
                        case "adults": return "Adults";
                        case "children": return "Children";
                        case "deliveryFreq": return "Delivery Frequency";
                        case "ethnicity": return "Ethnicity";
                        case "gender": return "Gender";
                        case "language": return "Language";
                        case "notes": return "Notes";
                        case "referralEntity": return "Referral Entity";
                        case "tefapCert": return "TEFAP Cert";
                        case "tags": return "Tags";
                        case "dob": return "Date of Birth";
                        case "ward": return "Ward";
                        default: return propertyKey.charAt(0).toUpperCase() + propertyKey.slice(1);
                    }
                };
                
                const columnLabel = getColumnHeader(col.propertyKey);
                const value = (row as any)[col.propertyKey];
                
                if (col.propertyKey === 'referralEntity' && value) {
                    // Handle referralEntity object specially
                    baseData[columnLabel] = `${value.name || 'N/A'}, ${value.organization || 'N/A'}`;
                } else if (Array.isArray(value)) {
                    // Handle arrays (like tags)
                    baseData[columnLabel] = value.join(", ");
                } else {
                    // Handle regular values
                    baseData[columnLabel] = value?.toString() || "N/A";
                }
            }
        });

        return baseData;
    });

    const csv = Papa.unparse(visibleData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "query_results.csv");
};

/**
 * Export all data as a CSV file with formatted, readable output.
 * @param rows - The data to export.
 */
export const exportAllClients = (rows: RowData[]) => {
    const formattedData = rows.map((row) => {
        // Format the data in a readable way
        return {
            "UID": row.uid,
            "Name": `${row.lastName}, ${row.firstName}`,
            "Phone": row.phone || "N/A",
            "Address": row.address,
            "House Number": row.houseNumber || "N/A",
            "Street Name": row.streetName || "N/A",
            "Zip Code": row.zipCode || "N/A",
            "Ward": row.ward || "N/A",
            "Cluster ID": row.clusterID || "N/A",
            "Delivery Instructions": row.deliveryDetails?.deliveryInstructions || "None",
            "Dietary Restrictions": row.deliveryDetails?.dietaryRestrictions
                ? Object.entries(row.deliveryDetails.dietaryRestrictions)
                    .filter(([key, value]) => value === true || (Array.isArray(value) && value.length > 0))
                    .map(([key]) => key)
                    .join(", ")
                : "None",
            "Food Allergens": row.deliveryDetails?.dietaryRestrictions?.foodAllergens?.join(", ") || "None",
            "Ethnicity": row.ethnicity || "N/A",
            "Adults": row.adults || "N/A",
            "Children": row.children || "N/A",
            "Delivery Frequency": row.deliveryFreq || "N/A",
            "Gender": row.gender || "N/A",
            "Language": row.language || "N/A",
            "Notes": row.notes || "N/A",
            "Referral Entity": row.referralEntity 
                ? `${row.referralEntity.name || 'N/A'}, ${row.referralEntity.organization || 'N/A'}`
                : "N/A",
            "TEFAP Cert": row.tefapCert || "N/A",
            "Tags": row.tags?.join(", ") || "N/A",
            "Date of Birth": row.dob || "N/A"
        };
    });

    const csv = Papa.unparse(formattedData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "all_clients.csv");
};