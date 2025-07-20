# 🧪 Project Test Suite Overview

[Back to README](./README.md)

[View Code Coverage Report](./coverage/lcov-report/index.html)

---

This project uses Jest, a popular JavaScript testing framework, to make sure our code works as expected. Jest lets us write tests that automatically check if different parts of our app behave correctly, so we can catch bugs early and keep our code reliable. Each test describes a specific feature or function, and Jest runs all these tests every time we make changes. This helps us know right away if something breaks. If you've never used Jest before, don't worry—each test is written in plain English and checks things like "does this button show up?" or "does this page load correctly?". By reading the test list below, you can see exactly what parts of the app are being checked and learn how automated testing helps keep our project stable and easy to improve.

## Test List

## src/auth/__tests__/AuthProvider.test.tsx
- **renders without crashing and provides default context** – Checks AuthProvider renders and provides default context values.
- **logout function does not throw when called with default context** – Verifies logout does not cause errors with default context.

## src/__tests__/minimal.test.tsx
- **renders a simple div** – Tests rendering of a basic div element.

## src/__tests__/minimal-with-setupTests.test.tsx
- **renders a simple div** – Tests rendering of a basic div with setupTests.

## src/__tests__/minimal-with-firebase.test.tsx
- **initializes Firebase and renders a div** – Checks Firebase initialization and div rendering.

## src/__tests__/minimal-with-mui.test.tsx
- **renders a div inside ThemeProvider** – Tests rendering a div inside a MUI ThemeProvider.

## src/__tests__/minimal-with-test-utils.test.tsx
- **renders a div using WithMuiTheme** – Verifies rendering a div using the WithMuiTheme utility.

## src/__tests__/minimal-with-firestore.test.tsx
- **initializes Firestore and renders a div** – Checks Firestore initialization and div rendering.

## src/__tests__/minimal-with-auth.test.tsx
- **initializes Auth and renders a div** – Verifies Auth initialization and div rendering.

## src/__tests__/minimal-with-functions.test.tsx
- **initializes Functions and renders a div** – Tests Functions initialization and div rendering.

## src/__tests__/minimal-with-all-firebase.test.tsx
- **initializes Firestore, Auth, Functions and renders a div** – Checks initialization of all Firebase services and div rendering.

## src/components/UsersSpreadsheet/__tests__/UsersSpreadsheet.minimal.test.tsx
- **renders with minimal props and providers** – Tests UsersSpreadsheet with minimal required props and providers.

## src/__tests__/UsersSpreadsheet.minimal.test.tsx
- **renders with minimal props and providers** – Tests UsersSpreadsheet with minimal required props and providers.

## src/services/__tests__/AuthUserService.test.ts
- **Admin can create all user types** – Verifies Admin can create any user type.
- **Manager can only create ClientIntake** – Checks Manager can only create ClientIntake users.
- **Other types cannot create any user** – Ensures other user types cannot create users.

## src/components/UsersSpreadsheet/__tests__/CreateUserModal.test.tsx
- **shows validation error for empty email** – Checks validation error appears when email is empty.
- **shows error if passwords do not match** – Verifies error appears when passwords do not match.

## src/components/UsersSpreadsheet/__tests__/DeleteUserModal.test.tsx
- **calls onDelete when delete is clicked** – Ensures delete callback is called when delete is clicked.

## src/components/UsersSpreadsheet/__tests__/UsersSpreadsheet.test.tsx
- **renders user spreadsheet table** – Tests rendering of the user spreadsheet table.

## src/__tests__/route-config.test.tsx
- **renders correct component for route: [path]** – Checks that the correct component is rendered for each route.
