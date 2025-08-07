// useCustomColumns.ts
import { SelectChangeEvent } from "@mui/material";
import { useEffect, useState } from "react";
import { DeliveryDetails, DietaryRestrictions } from '../types';
import type { RowData } from '../types/row-types';

interface useCustomColumnsProps {
  page: string
}

// Define the CustomColumn interface to ensure type-safety
export interface CustomColumn {
  id: string;
  label: string;
  propertyKey: string; // This can be extended with a union type if needed (e.g. "none" | "ethnicity" | ...)
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
  // Manage the custom columns state. Default to [] if not found in local storage
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(() => {
    const saved = localStorage.getItem(`ffaCustomColumns${page}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.warn('Failed to parse custom columns from localStorage:', error);
        return [];
      }
    }
    return [];
  });

  //detect custom column change and update local store
  useEffect(() => {
    localStorage.setItem(`ffaCustomColumns${page}`, JSON.stringify(customColumns))
  }, [customColumns, page])

  // Function to add a new custom column
  const handleAddCustomColumn = () => {
    const newColumnId = `custom-${Date.now()}`; // Unique id generation
    const newColumn: CustomColumn = {
      id: newColumnId,
      label: `Custom ${customColumns.length + 1}`,
      propertyKey: "none",
    };
    setCustomColumns([...customColumns, newColumn]);
  };

  const handleCustomColumnChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    id: string, // ID of the row being edited
    propertyKey: keyof RowData,
    setRows: React.Dispatch<React.SetStateAction<RowData[]>>
  ) => {
    const newValue = e.target.value; // Get the new value from the input

    setRows((prevRows) =>
      prevRows.map((row) => {
        if (row.id === id) {
          return {
            ...row,
            [propertyKey]: newValue, // Update the property w/ key
          };
        }
        return row;
      })
    );
  };

  // Function to update the custom column header (property key) when it changes
  const handleCustomHeaderChange = (event: SelectChangeEvent<string>, columnId: string) => {
    const newPropertyKey = event.target.value as string;
    setCustomColumns((prevColumns) =>
      prevColumns.map((col) =>
        col.id === columnId ? { ...col, propertyKey: newPropertyKey } : col
      )
    );

    console.log(`Custom Column ID: ${columnId}, New Property Key: ${newPropertyKey}`);
  };

  // Function to remove a custom column by filtering it out of the state
  const handleRemoveCustomColumn = (columnIdToRemove: string) => {
    setCustomColumns((prevColumns) =>
      prevColumns.filter((column) => column.id !== columnIdToRemove)
    );
  };

  // Return the state and the functions so they can be used in a component
  return {
    customColumns,
    handleAddCustomColumn,
    handleCustomHeaderChange,
    handleRemoveCustomColumn,
    handleCustomColumnChange,
  };
};
