/**
 * Miscellaneous utility functions
 */

/**
 * Generates a unique 12-digit UID
 * @returns A promise that resolves to a unique ID
 */
export const generateUID = (): string => {
  return Math.floor(Math.random() * 1000000000000)
    .toString()
    .padStart(12, "0");
};

/**
 * Verifies if two notes objects are different
 * @param notes Current notes
 * @param prevNotesTimestamp Previous notes with timestamp
 * @returns The updated notes object with timestamp if needed
 */
export const checkIfNotesExists = (
  notes: string,
  prevNotesTimestamp: { notes: string; timestamp: Date } | null
): { notes: string; timestamp: Date } | null => {
  if (!prevNotesTimestamp && notes.trim() !== "") {
    return { notes, timestamp: new Date() };
  }

  return prevNotesTimestamp;
};

/**
 * Delays execution for specified milliseconds
 * @param ms Milliseconds to delay
 * @returns A promise that resolves after the delay
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Safely access nested object properties with optional chaining
 * @param obj The object to access
 * @param path The path to the property as a dot-separated string
 * @param defaultValue The default value to return if the property doesn't exist
 * @returns The property value or default value
 */
export const getNestedValue = (obj: any, path: string, defaultValue: any = undefined): any => {
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result === undefined || result === null) {
      return defaultValue;
    }
    result = result[key];
  }
  
  return result !== undefined ? result : defaultValue;
}; 