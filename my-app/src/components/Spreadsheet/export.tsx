import Papa from "papaparse";
import { saveAs } from "file-saver";

export interface RowData {
    id: string;
    firstName: string;
    lastName: string;
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
            other: string[];
            softFood: boolean;
            vegan: boolean;
            vegetarian: boolean;
        };
    };
    ethnicity: string;
}

/**
 * Export visible columns as a CSV file.
 * @param rows - The data to export.
 */
export const exportQueryResults = (rows: RowData[]) => {
    const visibleData = rows.map((row) => ({
        Name: `${row.lastName}, ${row.firstName}`,
        Address: row.address,
        "Delivery Instructions": row.deliveryDetails?.deliveryInstructions || "None", // Add null/undefined check
        "Dietary Restrictions": row.deliveryDetails?.dietaryRestrictions
            ? Object.entries(row.deliveryDetails.dietaryRestrictions)
                .filter(([key, value]) => value === true || (Array.isArray(value) && value.length > 0))
                .map(([key]) => key)
                .join(", ")
            : "None", // Add null/undefined check
    }));

    const csv = Papa.unparse(visibleData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "query_results.csv");
};

/**
 * Export all data as a CSV file.
 * @param rows - The data to export.
 */
export const exportAllClients = (rows: RowData[]) => {
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "all_clients.csv");
};