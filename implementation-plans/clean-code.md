# Clean Code Guide

Reference guide for clean code principles and implementation approach.

## Core Principles

### 1. Meaningful Names
Variables and functions should be self-explanatory.

```typescript
// Bad
const d = new Date();
const u = users.filter(x => x.a);

// Good
const currentDate = new Date();
const activeUsers = users.filter(user => user.isActive);
```

### 2. Small Functions
Functions should do one thing well.

```typescript
// Bad - Does too many things
function processUser(user) {
  validateUser(user);
  formatUserData(user);
  saveUser(user);
  sendEmail(user);
}

// Good - Single responsibility
function validateUser(user: User): boolean { }
function formatUserData(user: User): User { }
function saveUser(user: User): void { }
```

### 3. DRY (Don't Repeat Yourself)
Extract common patterns into reusable functions/components.

### 4. Comments Explain WHY, Not WHAT
Code should be self-explanatory. Comments explain business logic.

### 5. Error Handling
Handle errors gracefully with meaningful messages.

### 6. Consistent Formatting
Use consistent indentation, spacing, and naming conventions.

## Implementation Modules

See `clean_code_implementation_plan.md` for full roadmap.

**Completed:** Components, Auth, Navigation, Services, Users
**Remaining:** Calendar, Clients, Delivery

## Naming Conventions

- Variables & Functions: `camelCase` (e.g., `getUserData`)
- Components: `PascalCase` (e.g., `UserProfile`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_COUNT`)
- Files: `kebab-case` or `PascalCase` for components

## Project Structure

```
src/
├── components/    # Reusable UI components
├── pages/         # Page-level components
├── services/      # API and business logic
├── hooks/         # Custom React hooks
├── utils/         # Utility functions
├── types/         # TypeScript type definitions
└── styles/        # Global styles and themes
```

## Getting Started

1. Review `clean_code_implementation_plan.md`
2. Choose a module from remaining work
3. Read the specific module guide
4. Create branch: `git checkout -b clean-code-[module]`
5. Follow phases sequentially
6. Test thoroughly after each phase

## Success Metrics

- Functions under 20 lines
- Components under 500 lines
- TypeScript coverage 95%+
- Reduced bug reports
