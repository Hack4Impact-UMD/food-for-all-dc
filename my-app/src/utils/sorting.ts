/**
 * Generalized sorting algorithm for table columns
 * Supports multiple data types and nested object properties
 */

export type SortDirection = "asc" | "desc";

export interface SortConfig<T> {
  key: string;
  direction: SortDirection;
  getValue?: (item: T) => any;
}

/**
 * Generic sorting function that can handle various data types
 */
export function sortData<T extends Record<string, any>>(data: T[], config: SortConfig<T>): T[] {
  if (!data || data.length === 0) {
    return data;
  }

  return [...data].sort((a, b) => {
    const aValue = config.getValue ? config.getValue(a) : getNestedValue(a, config.key);
    const bValue = config.getValue ? config.getValue(b) : getNestedValue(b, config.key);

    const comparison = compareValues(aValue, bValue);
    return config.direction === "asc" ? comparison : -comparison;
  });
}

/**
 * Get nested property value from an object using dot notation
 * Example: getNestedValue(obj, "user.profile.name")
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
}

/**
 * Compare two values of potentially different types
 */
function compareValues(a: any, b: any): number {
  // Handle null/undefined values
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  // Convert to comparable values
  const normalizedA = normalizeValue(a);
  const normalizedB = normalizeValue(b);

  // Compare based on type
  if (typeof normalizedA === "number" && typeof normalizedB === "number") {
    return normalizedA - normalizedB;
  }

  if (typeof normalizedA === "boolean" && typeof normalizedB === "boolean") {
    return normalizedA === normalizedB ? 0 : normalizedA ? 1 : -1;
  }

  if (normalizedA instanceof Date && normalizedB instanceof Date) {
    return normalizedA.getTime() - normalizedB.getTime();
  }

  // Default to string comparison
  const strA = String(normalizedA).toLowerCase();
  const strB = String(normalizedB).toLowerCase();

  return strA.localeCompare(strB);
}

/**
 * Normalize values for consistent comparison
 */
function normalizeValue(value: any): any {
  if (value == null) return null;

  // Handle arrays - join them for comparison
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  // Handle objects - convert to string representation
  if (typeof value === "object" && value.constructor === Object) {
    // For objects like referralEntity, create a searchable string
    const objValues = Object.values(value).filter((v) => v != null);
    return objValues.join(" ");
  }

  // Handle dates
  if (value instanceof Date) {
    return value;
  }

  // Try to parse as number
  if (typeof value === "string") {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && isFinite(numValue)) {
      return numValue;
    }
  }

  // Try to parse as date
  if (typeof value === "string") {
    const dateValue = new Date(value);
    if (!isNaN(dateValue.getTime())) {
      return dateValue;
    }
  }

  // Try to parse as boolean
  if (typeof value === "string") {
    const lowerValue = value.toLowerCase();
    if (lowerValue === "true") return true;
    if (lowerValue === "false") return false;
  }

  return value;
}

/**
 * Multi-column sorting function
 */
export function sortDataMultiple<T extends Record<string, any>>(
  data: T[],
  configs: SortConfig<T>[]
): T[] {
  if (!data || data.length === 0 || !configs || configs.length === 0) {
    return data;
  }

  return [...data].sort((a, b) => {
    for (const config of configs) {
      const aValue = config.getValue ? config.getValue(a) : getNestedValue(a, config.key);
      const bValue = config.getValue ? config.getValue(b) : getNestedValue(b, config.key);

      const comparison = compareValues(aValue, bValue);
      const result = config.direction === "asc" ? comparison : -comparison;

      if (result !== 0) {
        return result;
      }
    }
    return 0;
  });
}

/**
 * Hook for managing sort state in components
 */
export function createSortState<T extends Record<string, any>>(
  initialKey?: string,
  initialDirection: SortDirection = "asc"
) {
  return {
    sortKey: initialKey || null,
    sortDirection: initialDirection,

    toggleSort: function (key: string, currentKey: string | null, currentDirection: SortDirection) {
      if (currentKey === key) {
        // Same column, toggle direction
        return {
          sortKey: key,
          sortDirection: currentDirection === "asc" ? "desc" : ("asc" as SortDirection),
        };
      } else {
        // Different column, start with ascending
        return {
          sortKey: key,
          sortDirection: "asc" as SortDirection,
        };
      }
    },

    getSortedData: function (
      data: T[],
      sortKey: string | null,
      sortDirection: SortDirection,
      getValue?: (item: T, key: string) => any
    ): T[] {
      if (!sortKey) return data;

      return sortData(data, {
        key: sortKey,
        direction: sortDirection,
        getValue: getValue ? (item: T) => getValue(item, sortKey) : undefined,
      });
    },
  };
}

/**
 * Utility function to create custom getValue functions for complex data
 */
export const createValueGetters = {
  /**
   * For computed fields like fullname
   */
  computed: <T>(computeFn: (item: T) => any) => computeFn,

  /**
   * For nested object properties
   */
  nested:
    <T>(path: string) =>
    (item: T) =>
      getNestedValue(item, path),

  /**
   * For array fields (joins array elements)
   */
  array:
    <T>(key: string, separator = ", ") =>
    (item: T) => {
      const value = getNestedValue(item, key);
      return Array.isArray(value) ? value.join(separator) : value;
    },

  /**
   * For object fields (creates searchable string)
   */
  object:
    <T>(key: string) =>
    (item: T) => {
      const value = getNestedValue(item, key);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return Object.values(value)
          .filter((v) => v != null)
          .join(" ");
      }
      return value;
    },
};
