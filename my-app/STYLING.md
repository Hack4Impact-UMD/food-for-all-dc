# Food For All DC Styling System

## Overview

This project uses a mixed styling approach with CSS Modules and Material UI, with a centralized theme system using CSS variables.

## Key Components

### 1. CSS Variables for Theming (`src/styles/theme.css`)

All design tokens are defined as CSS variables in a single source of truth:

```css
:root {
  --color-primary: #257E68;
  --spacing-md: 1rem;
  --font-size-base: 1rem;
  /* etc. */
}
```

Use these variables throughout your CSS and inline styles:

```css
.myButton {
  background-color: var(--color-primary);
  padding: var(--spacing-md);
}
```

### 2. CSS Modules (`.module.css` files)

Component-specific styles are defined in CSS Module files:

```tsx
// MyComponent.tsx
import styles from './MyComponent.module.css';

function MyComponent() {
  return <div className={styles.container}>...</div>;
}
```

```css
/* MyComponent.module.css */
.container {
  color: var(--color-primary);
  padding: var(--spacing-md);
}
```

### 3. Reusable UI Components

Common UI components have been created for consistent styling:

- `Button` (`src/components/common/Button`)
- `Input` (`src/components/common/Input`)

Use these components instead of building one-off custom components:

```tsx
import { Button, Input } from '../components/common';

function MyForm() {
  return (
    <form>
      <Input label="Name" />
      <Button variant="primary">Submit</Button>
    </form>
  );
}
```

## Styling Guidelines

1. **Always use theme variables**:
   - Use CSS variables for all design tokens (colors, spacing, etc.)
   - Never hardcode values like `#257E68` or `16px`

2. **Use CSS Modules for component styles**:
   - Name files as `ComponentName.module.css`
   - Use camelCase for class names
   - Import as `import styles from './ComponentName.module.css'`

3. **Material UI styling**:
   - Use Material UI components when appropriate
   - For custom styling, use the `sx` prop with CSS variables:
   ```tsx
   <Box sx={{ 
     backgroundColor: 'var(--color-primary)',
     padding: 'var(--spacing-md)'
   }}>
   ```

4. **Common components**:
   - Use the common components for consistent UI
   - Extend them as needed for specific use cases

## File Organization


## Migration Guide

When converting existing components:

1. Create a `.module.css` file next to the component
2. Replace traditional CSS imports with CSS Module imports
3. Replace class names with `styles.className` references
4. Replace hardcoded values with CSS variables

Example:
```tsx
// Before
import './OldComponent.css';
<div className="container" style={{ color: '#257E68' }}>

// After
import styles from './OldComponent.module.css';
<div className={styles.container}>
```

```css
/* OldComponent.module.css */
.container {
  color: var(--color-primary);
}
```