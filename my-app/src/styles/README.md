# Styling Guide for Food For All DC

## Overview

This project uses a mixed styling approach with CSS Modules and Material UI:

1. **CSS Modules** - For component-specific styles, with `.module.css` files
2. **CSS Variables** - For a consistent theme (colors, spacing, etc.)
3. **Material UI** - For UI components with customized styling

## CSS Modules

CSS Modules scope styles to specific components, preventing class name collisions:

```jsx
// ExampleComponent.tsx
import styles from './ExampleComponent.module.css';

function ExampleComponent() {
  return <div className={styles.container}>...</div>;
}
```

```css
/* ExampleComponent.module.css */
.container {
  color: var(--color-primary);
  padding: var(--spacing-md);
}
```

## Theming

Use the centralized theme variables from `theme.css`:

- Colors: `var(--color-primary)`, `var(--color-text-secondary)`, etc.
- Spacing: `var(--spacing-sm)`, `var(--spacing-md)`, etc.
- Typography: `var(--font-size-base)`, `var(--font-family-main)`, etc.

## Material UI Styling

When using Material UI components:

```jsx
// With the sx prop
<Button 
  sx={{ 
    backgroundColor: 'var(--color-primary)',
    borderRadius: 'var(--border-radius-xl)',
  }}
>
  Click Me
</Button>

// Using styled components from MUI
import { styled } from '@mui/material';

const CustomButton = styled(Button)({
  backgroundColor: 'var(--color-primary)',
  borderRadius: 'var(--border-radius-xl)',
  '&:hover': {
    backgroundColor: 'var(--color-primary-light)',
  }
});
```

## File Organization

- Place component CSS modules next to their respective components
- Import them as follows: `import styles from './ComponentName.module.css'`
- Use semantic class names based on function, not appearance
- Combine with Material UI's `sx` prop for one-off styling needs

## Naming Conventions

- CSS Module files: `ComponentName.module.css`
- Class names: camelCase (e.g., `.loginContainer`, `.formField`)
- Use meaningful names based on component functionality

## Best Practices

1. Always use variables from the theme for colors, spacing, etc.
2. Keep styles modular and component-specific
3. Avoid inline styles directly in components
4. Use Material UI's styling system for complex components
5. Limit specificity and nesting to prevent styling conflicts