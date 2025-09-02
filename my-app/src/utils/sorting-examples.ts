/**
 * Example usage of the generalized sorting algorithm
 * This file demonstrates how to implement sorting for different column types
 */

import React from "react";
import { sortData, SortDirection, createValueGetters, createSortState } from "./sorting";

// Example data interface (similar to your RowData)
interface ExampleRowData {
  id: string;
  firstName: string;
  lastName: string;
  address: string;
  phone?: string;
  adults: number;
  children: number;
  tags: string[];
  deliveryDetails: {
    deliveryInstructions: string;
    dietaryRestrictions: {
      vegan: boolean;
      halal: boolean;
      foodAllergens: string[];
    };
  };
  referralEntity?: {
    name: string;
    organization: string;
  };
  dob: string;
  ward: string;
}

/**
 * Column-by-column implementation examples
 */

// 1. Simple string column (Address)
export function sortByAddress(data: ExampleRowData[], direction: SortDirection) {
  return sortData(data, {
    key: "address",
    direction,
  });
}

// 2. Computed field (Full Name)
export function sortByFullName(data: ExampleRowData[], direction: SortDirection) {
  return sortData(data, {
    key: "fullname", // This key won't exist in data, but getValue will handle it
    direction,
    getValue: (item) => `${item.lastName}, ${item.firstName}`,
  });
}

// 3. Numeric column (Adults)
export function sortByAdults(data: ExampleRowData[], direction: SortDirection) {
  return sortData(data, {
    key: "adults",
    direction,
  });
}

// 4. Array column (Tags)
export function sortByTags(data: ExampleRowData[], direction: SortDirection) {
  return sortData(data, {
    key: "tags",
    direction,
    getValue: createValueGetters.array("tags"),
  });
}

// 5. Nested object property (Delivery Instructions)
export function sortByDeliveryInstructions(data: ExampleRowData[], direction: SortDirection) {
  return sortData(data, {
    key: "deliveryDetails.deliveryInstructions",
    direction,
  });
}

// 6. Complex computed field (Dietary Restrictions)
export function sortByDietaryRestrictions(data: ExampleRowData[], direction: SortDirection) {
  return sortData(data, {
    key: "dietaryRestrictions",
    direction,
    getValue: (item) => {
      const restrictions = [];
      const dr = item.deliveryDetails?.dietaryRestrictions;
      if (!dr) return "None";

      if (dr.vegan) restrictions.push("Vegan");
      if (dr.halal) restrictions.push("Halal");
      if (Array.isArray(dr.foodAllergens) && dr.foodAllergens.length > 0) {
        restrictions.push(...dr.foodAllergens);
      }

      return restrictions.length > 0 ? restrictions.join(", ") : "None";
    },
  });
}

// 7. Object field (Referral Entity)
export function sortByReferralEntity(data: ExampleRowData[], direction: SortDirection) {
  return sortData(data, {
    key: "referralEntity",
    direction,
    getValue: (item) => {
      if (!item.referralEntity) return "";
      return `${item.referralEntity.name} ${item.referralEntity.organization}`;
    },
  });
}

// 8. Date field (Date of Birth)
export function sortByDateOfBirth(data: ExampleRowData[], direction: SortDirection) {
  return sortData(data, {
    key: "dob",
    direction,
    getValue: (item) => new Date(item.dob),
  });
}

/**
 * React component usage example
 */
export function useTableSorting<T extends Record<string, any>>(initialData: T[]) {
  const [data, setData] = React.useState(initialData);
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");

  const sortState = createSortState<T>();

  const handleSort = (columnKey: string, getValue?: (item: T) => any) => {
    const newSortState = sortState.toggleSort(columnKey, sortKey, sortDirection);
    setSortKey(newSortState.sortKey);
    setSortDirection(newSortState.sortDirection);

    const sortedData = sortState.getSortedData(
      data,
      newSortState.sortKey,
      newSortState.sortDirection,
      getValue ? (item: T, key: string) => getValue(item) : undefined
    );

    setData(sortedData);
  };

  return {
    data,
    sortKey,
    sortDirection,
    handleSort,
    setData,
  };
}

/**
 * Column configuration for easy implementation
 */
export interface ColumnConfig<T> {
  key: string;
  label: string;
  sortable: boolean;
  getValue?: (item: T) => any;
}

export const exampleColumnConfigs: ColumnConfig<ExampleRowData>[] = [
  {
    key: "fullname",
    label: "Name",
    sortable: true,
    getValue: (item) => `${item.lastName}, ${item.firstName}`,
  },
  {
    key: "address",
    label: "Address",
    sortable: true,
  },
  {
    key: "phone",
    label: "Phone",
    sortable: true,
  },
  {
    key: "adults",
    label: "Adults",
    sortable: true,
  },
  {
    key: "tags",
    label: "Tags",
    sortable: true,
    getValue: createValueGetters.array("tags"),
  },
  {
    key: "deliveryDetails.deliveryInstructions",
    label: "Delivery Instructions",
    sortable: true,
  },
  {
    key: "dietaryRestrictions",
    label: "Dietary Restrictions",
    sortable: true,
    getValue: (item) => {
      const restrictions = [];
      const dr = item.deliveryDetails?.dietaryRestrictions;
      if (!dr) return "None";

      if (dr.vegan) restrictions.push("Vegan");
      if (dr.halal) restrictions.push("Halal");
      if (Array.isArray(dr.foodAllergens) && dr.foodAllergens.length > 0) {
        restrictions.push(...dr.foodAllergens);
      }

      return restrictions.length > 0 ? restrictions.join(", ") : "None";
    },
  },
];

/**
 * Usage in a table component:
 *
 * const { data, sortKey, sortDirection, handleSort } = useTableSorting(initialData);
 *
 * // In your table header:
 * <TableCell onClick={() => handleSort("fullname", (item) => `${item.lastName}, ${item.firstName}`)}>
 *   Name
 *   {sortKey === "fullname" && (
 *     sortDirection === "asc" ? <ArrowUpIcon /> : <ArrowDownIcon />
 *   )}
 * </TableCell>
 */
