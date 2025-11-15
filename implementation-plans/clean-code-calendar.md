# Clean Code: Calendar System

Status: In Progress

## Overview
Calendar system manages delivery scheduling, event creation, and date handling.

## Code Issues to Address
- Complex date manipulation without proper utilities
- Mixed calendar view logic
- Unclear event handling
- Inconsistent date formatting
- Large calendar component

## Implementation Tasks

### Phase 1: Date Utilities
Goal: Extract and standardize date operations

Tasks:
1. [ ] Review `src/utils/dates.ts` - identify missing utilities
2. [ ] Create date formatting functions:
   - `formatDateForDisplay(date: Date): string`
   - `formatDateForInput(date: Date): string`
   - `formatDateRange(start: Date, end: Date): string`
3. [ ] Add date validation utilities:
   - `isValidDate(date: Date): boolean`
   - `isDateInRange(date: Date, start: Date, end: Date): boolean`
   - `isPastDate(date: Date): boolean`
4. [ ] Extract date calculation logic:
   - `getNextMonth(date: Date): Date`
   - `getPreviousMonth(date: Date): Date`
   - `getStartOfWeek(date: Date): Date`
   - `getEndOfWeek(date: Date): Date`
5. [ ] Standardize date handling across components

Files to Modify:
- `src/utils/dates.ts`
- `src/pages/Calendar/CalendarPage.tsx`
- `src/pages/Calendar/components/`

### Phase 2: Component Separation
Goal: Break down large calendar component

Tasks:
1. [ ] Extract calendar header component:
   - Create `CalendarHeader.tsx`
   - Move navigation logic
   - Move view switcher logic
2. [ ] Create separate view components:
   - `MonthView.tsx` - Month calendar view
   - `DayView.tsx` - Single day view
   - `WeekView.tsx` - Week view (if exists)
3. [ ] Isolate event creation logic:
   - Extract `AddDeliveryDialog.tsx` logic
   - Create `EventForm.tsx` component
   - Separate validation logic
4. [ ] Clean up event handling:
   - Create `useCalendarEvents` hook
   - Extract event CRUD operations
   - Improve event state management

Files to Create/Modify:
- `src/pages/Calendar/components/CalendarHeader.tsx` - NEW
- `src/pages/Calendar/components/MonthView.tsx` - Extract
- `src/pages/Calendar/components/DayView.tsx` - Extract
- `src/pages/Calendar/components/EventForm.tsx` - NEW
- `src/pages/Calendar/hooks/useCalendarEvents.ts` - NEW
- `src/pages/Calendar/CalendarPage.tsx` - Refactor

### Phase 3: Event Management
Goal: Simplify event CRUD operations

Tasks:
1. [ ] Simplify event CRUD operations:
   - Review `src/services/delivery-service.ts`
   - Ensure consistent method names
   - Add proper error handling
2. [ ] Improve event validation:
   - Create `validateEvent(event: Event): ValidationResult`
   - Add date range validation
   - Add required field validation
3. [ ] Better error handling:
   - Use `NotificationProvider` for errors
   - Add user-friendly error messages
   - Handle edge cases
4. [ ] Optimize event rendering:
   - Use `React.memo` for event components
   - Implement virtual scrolling if needed
   - Optimize re-renders

Files to Modify:
- `src/services/delivery-service.ts`
- `src/utils/validation.ts`
- `src/pages/Calendar/components/`

## Key Files

- `src/pages/Calendar/CalendarPage.tsx`
- `src/pages/Calendar/components/MonthView.tsx`
- `src/pages/Calendar/components/DayView.tsx`
- `src/pages/Calendar/components/AddDeliveryDialog.tsx`
- `src/utils/dates.ts`
- `src/types/calendar-types.ts`
- `src/services/delivery-service.ts`

## Success Criteria

- Calendar component under 200 lines
- Reusable date utilities
- Clear event handling
- Proper TypeScript types
- All calendar views working
- Event creation/editing working
- Date navigation working
- Responsive design maintained

## Getting Started

1. Create branch: `git checkout -b clean-code-calendar`
2. Start with Phase 1: Extract date utilities first
3. Test incrementally: Test after each phase
4. Update this guide: Document progress as you go
