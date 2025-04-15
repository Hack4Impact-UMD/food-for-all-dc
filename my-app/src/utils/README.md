# Utility Functions

This directory contains shared utility functions used throughout the application.

## Available Utilities

### Validation (`validation.ts`)
- `isValidEmail` - Email validation
- `isValidPhone` - Phone number validation
- `isEmpty` - Checks if a string is empty
- `isValidCoordinate` - Validates geographic coordinates
- `validateCaseWorkerFields` - Validates case worker form fields
- `validateDriverFields` - Validates driver form fields

### Formatting (`format.ts`)
- `formatPhoneNumber` - Formats phone numbers to (xxx)-xxx-xxxx format
- `getOrdinalSuffix` - Gets ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
- `capitalizeFirstLetter` - Capitalizes the first letter of a string
- `formatDietaryRestrictions` - Formats dietary restrictions from object to string
- `calculateAge` - Calculates age from date of birth

### Dates (`dates.ts`)
- `getRecurrencePattern` - Gets human-readable recurrence pattern from a date
- `getNextMonthlyDate` - Gets the next monthly date based on a pattern
- `formatDateToYYYYMMDD` - Formats a date to YYYY-MM-DD string
- `formatDate` - Formats a date to a readable string

### Miscellaneous (`misc.ts`)
- `generateUID` - Generates a unique 12-digit UID
- `checkIfNotesExists` - Checks if notes have changed
- `delay` - Promise-based delay function
- `getNestedValue` - Safely access nested object properties

## Usage

Import utilities from the root utils module:

```typescript
import { isValidEmail, formatPhoneNumber, formatDate } from '../utils';
``` 