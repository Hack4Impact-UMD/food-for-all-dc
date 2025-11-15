# Styling Guide

## Quick Decision Tree

1. **Common component exists?** → Use `Button`, `Input`, `Modal` from `src/components/common/`
2. **Component-specific styles?** → Create `ComponentName.module.css` with CSS variables
3. **MUI component?** → Use `sx` prop with CSS variables
4. **Global override needed?** → Add to `src/styles/form-field-global.css` (MUI only)

## CSS Variables (from `src/styles/theme.css`)

**Never hardcode colors, spacing, or font sizes.**

```css
/* Colors */
--color-primary: #257E68
--color-primary-light: #45a049
--color-text-primary: #282c34
--color-text-secondary: #787777
--color-background-main: #ffffff
--color-background-light: #f4f4f4
--color-border-light: #ddd
--color-error: #ff0000

/* Spacing */
--spacing-xs: 0.3125rem;  /* 5px */
--spacing-sm: 0.625rem;   /* 10px */
--spacing-md: 1rem;       /* 16px */
--spacing-lg: 1.25rem;    /* 20px */
--spacing-xl: 2rem;       /* 32px */

/* Typography */
--font-size-xs: 0.75rem;   /* 12px */
--font-size-sm: 0.875rem;  /* 14px */
--font-size-base: 1rem;    /* 16px */
--font-size-lg: 1.25rem;   /* 20px */
--font-size-xl: 1.5rem;    /* 24px */

/* Borders & Shadows */
--border-radius-sm: 0.3125rem;  /* 5px */
--border-radius-md: 0.5rem;     /* 8px */
--border-radius-lg: 1rem;       /* 16px */
--border-radius-xl: 1.5rem;     /* 24px */
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.15);
```

## Common Components

```tsx
import { Button, Input, Modal } from '../components/common';

// Button
<Button variant="primary" size="small" fullWidth icon={<Icon />}>
  Save
</Button>

// Input
<Input label="Name" value={name} onChange={setName} error={error} />

// Modal
<Modal open={isOpen} onClose={handleClose} title="Confirm" actions={...}>
  Content
</Modal>
```

## CSS Modules Pattern

**File:** `ComponentName.module.css` (next to component)

```tsx
// ComponentName.tsx
import styles from './ComponentName.module.css';

<div className={styles.container}>
  <h2 className={styles.title}>Title</h2>
</div>
```

```css
/* ComponentName.module.css */
.container {
  padding: var(--spacing-md);
  background-color: var(--color-background-main);
}

.title {
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
}
```

**Naming:** camelCase classes (`.formField`, `.submitButton`)

## Material UI Styling

```tsx
<Box sx={{ 
  backgroundColor: 'var(--color-primary)',
  padding: 'var(--spacing-md)',
  borderRadius: 'var(--border-radius-lg)'
}}>
```

## Rules

✅ **DO:**
- Use CSS variables from `theme.css`
- Use CSS Modules for component styles
- Use common components when possible
- Place `.module.css` files next to components

❌ **DON'T:**
- Hardcode colors (`#257E68`), spacing (`16px`), or font sizes
- Use inline styles (except dynamic values)
- Create global CSS for component styles
- Use `!important` (use CSS Modules specificity)

## File Structure

```
ComponentName/
  ├── ComponentName.tsx
  └── ComponentName.module.css
```
