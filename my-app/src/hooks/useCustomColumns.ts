export const allowedPropertyKeys = [
  "none",
  "address",
  "adults",
  "children",
  "deliveryFreq",
  "deliveryDetails.dietaryRestrictions",
  "deliveryDetails.dietaryRestrictions.dietaryPreferences",
  "ethnicity",
  "gender",
  "language",
  "notes",
  "phone",
  "referralEntity",
  "tags",
  "tefapCert",
  "dob",
  "lastDeliveryDate",
];

import { SelectChangeEvent } from "@mui/material";
import { useEffect, useState } from "react";
import { DeliveryDetails, DietaryRestrictions } from "../types";

interface useCustomColumnsProps {
  page: string;
}

export interface CustomColumn {
  id: string;
  label: string;
  propertyKey: string;
}

export interface CustomRowData {
  id: string;
  clientid?: string;
  uid: string;
  firstName: string;
  lastName: string;
  phone?: string;
  houseNumber?: number;
  address: string;
  deliveryDetails: DeliveryDetails;
  ethnicity: string;
}

export const useCustomColumns = ({ page }: useCustomColumnsProps) => {
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(() => {
    const saved = localStorage.getItem(`ffaCustomColumns${page}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.warn("Failed to parse custom columns from localStorage:", error);
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(`ffaCustomColumns${page}`, JSON.stringify(customColumns));
  }, [customColumns, page]);

  const handleAddCustomColumn = () => {
    const newColumnId = `custom-${Date.now()}`;
    const newColumn: CustomColumn = {
      id: newColumnId,
      label: `Custom ${customColumns.length + 1}`,
      propertyKey: "none",
    };
    setCustomColumns([...customColumns, newColumn]);
  };

  const handleCustomColumnChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    id: string,
    propertyKey: string,
    setRows: React.Dispatch<React.SetStateAction<any[]>>
  ) => {
    const newValue = e.target.value;

    setRows((prevRows) =>
      prevRows.map((row) => {
        if (row.id === id) {
          return {
            ...row,
            [propertyKey]: newValue,
          };
        }
        return row;
      })
    );
  };

  const handleCustomHeaderChange = (event: SelectChangeEvent<string>, columnId: string) => {
    const newPropertyKey = event.target.value as string;
    setCustomColumns((prevColumns) =>
      prevColumns.map((col) =>
        col.id === columnId ? { ...col, propertyKey: newPropertyKey } : col
      )
    );

    setCustomColumns((prevColumns) =>
      prevColumns.map((col) =>
        col.id === columnId && newPropertyKey === "deliveryDetails.dietaryRestrictions"
          ? { ...col, label: "Dietary Restrictions" }
          : col
      )
    );
  };

  const handleRemoveCustomColumn = (columnIdToRemove: string) => {
    setCustomColumns((prevColumns) =>
      prevColumns.filter((column) => column.id !== columnIdToRemove)
    );
  };

  return {
    customColumns,
    handleAddCustomColumn,
    handleCustomHeaderChange,
    handleRemoveCustomColumn,
    handleCustomColumnChange,
  };
};
