# Contributing Guidelines

## Getting Started

```bash
git clone <your-repo-url>
cd food-for-all-dc/my-app
npm install
npm start  # Opens at http://localhost:3000
```

**Firebase Setup (optional):**
```bash
npm install -g firebase-tools && firebase login
cd functions-python && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

## Code Standards

### TypeScript
- Use TypeScript for all new files
- Prefer interfaces over types for object shapes
- Avoid `any` type
- Use types from `src/types/` when available

### Components
- Functional components with hooks
- Keep components focused and reusable
- Extract reusable logic into utilities, hooks, or services

### Styling
- **Always use CSS variables** from `src/styles/theme.css` - never hardcode colors/spacing/fonts
- Use CSS Modules (`.module.css`) for component styles
- Use common components (`Button`, `Input`, `Modal`) from `src/components/common/`
- See [STYLING.md](my-app/STYLING.md) for details

### Architecture

**Services** (singleton pattern):
```typescript
const clientService = ClientService.getInstance();
const client = await clientService.getClientById(uid);
```
- Use `formatServiceError()` from `src/utils/serviceError.ts` for errors
- Use `retry()` from `src/utils/retry.ts` for operations that may fail

**State Management:**
- Global: React Context (`AuthProvider`, `ClientDataContext`, `RecurringDeliveryContext`)
- Local: Component state for forms/UI
- Refresh context after mutations

**Routing:**
- Routes in `src/routesConfig.tsx`
- Use `ProtectedRoute` from `src/auth/ProtectedRoute.tsx` for role-based access
- Roles: `UserType.Admin`, `UserType.Manager`, `UserType.ClientIntake`, `UserType.Driver`
- Lazy load page components (except login/forgot-password)

### Naming Conventions
- Components/types/enums: PascalCase (`ClientProfile.tsx`)
- Variables/functions: camelCase
- Constants: UPPER_SNAKE_CASE
- Booleans: is/has/should prefix (`isLoading`)
- Hooks/handlers: `useX`, `handleX`/`onX`
- Services: `Service` suffix (`ClientService`)

## Pull Request Process

### Before Submitting

1. **Run checks:**
   ```bash
   npm run lint       # Must pass
   npm run lint:fix   # Auto-fix issues
   npm run build      # Must succeed
   npx tsc --noEmit   # TypeScript check
   ```

2. **Code review checklist:**
   - ✅ No console.logs (use `NotificationProvider` for errors)
   - ✅ No sensitive data (API keys, tokens)
   - ✅ CSS variables used (no hardcoded values)
   - ✅ Common components used when appropriate
   - ✅ Error handling uses `formatServiceError()`
   - ✅ Services use singleton pattern
   - ✅ No `any` types

3. **Test:**
   - Test with different user roles if applicable
   - Test edge cases and error scenarios

### PR Title Format
- `Feature: [description]` - New features
- `Fix: [description]` - Bug fixes
- `Refactor: [description]` - Code improvements
- `Docs: [description]` - Documentation
- `Style: [description]` - Styling changes

### PR Description
- **What**: What does this PR do?
- **Testing**: How did you test it?
- **Screenshots**: (If UI changes)

## Common Workflows

### Adding a Page
1. Create component: `src/pages/NewPage/NewPage.tsx`
2. Create CSS Module: `src/pages/NewPage/NewPage.module.css` (if needed)
3. Add route to `src/routesConfig.tsx` with `meta` info
4. Wrap with `ProtectedRoute` if auth required
5. Add nav link in `src/pages/Base/Base.tsx` (if needed)
6. Use context hooks (`useAuth`, `useClientData`) and services

### Modifying Client Data
1. Update type in `src/types/client-types.ts`
2. Update form components (`src/components/ClientProfile.tsx`, `src/pages/Profile/`)
3. Add validation to `src/utils/firestoreValidation.ts`
4. Update Spreadsheet (`src/components/Spreadsheet/`) if visible/editable
5. Update export (`src/config/exportConfig.ts`) if exported
6. Update `ClientService` methods if needed

### Firebase Operations
- Validate with `firestoreValidation` before writes
- Wrap errors with `formatServiceError()`
- Show errors via `NotificationProvider`
- Collections: `client-profile2`, `events`, `users`, `Drivers2`, `clusters`, `referral`, `limits`, `tags`

### Performance
- Lazy load page components
- Use `React.memo()` for heavy components
- Use `react-virtuoso` for large lists (3000+ items)
- Cache roles and recurring deliveries (5 min)

## Git Workflow

- Create feature branches from `main`
- Use descriptive commit messages (see PR Title Format above)
- Submit PRs for all changes
- Delete branch after merge

## Available Scripts

```bash
npm start          # Development server
npm run build      # Production build
npm run lint       # Run ESLint
npm run lint:fix   # Fix linting issues
npm run format     # Format with Prettier
```

## Resources

- **[STYLING.md](my-app/STYLING.md)** - Detailed styling guidelines
- **[README.md](README.md)** - Project overview

Thank you for contributing! 🥗
