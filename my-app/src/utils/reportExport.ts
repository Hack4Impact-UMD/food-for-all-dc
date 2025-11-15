import Papa from "papaparse";
import { saveAs } from "file-saver";

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) {
    alert("No data available to export.");
    return;
  }

  try {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, filename);
  } catch (error) {
    console.error("Error exporting to CSV:", error);
    alert("Failed to export CSV. Please try again.");
  }
};

export const formatDateRange = (startDate: Date | null, endDate: Date | null): string => {
  if (!startDate || !endDate) return "";

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return `${formatDate(startDate)}_to_${formatDate(endDate)}`;
};
