# Clean Code: Delivery Management

Status: Pending

## Overview
Delivery management system handles delivery scheduling, route optimization, clustering, and driver assignments. Largest component (2000+ lines) with map integration and optimization algorithms.

## Code Issues to Address
- Complex delivery spreadsheet (2000+ lines)
- Mixed map and data logic
- Unclear clustering algorithms
- Inconsistent route handling
- Poor error handling in async operations

## Implementation Tasks

### Phase 1: Algorithm Extraction
Goal: Separate business logic from UI

Tasks:
1. [ ] Extract clustering logic:
   - Review `functions-python/clustering.py`
   - Create `src/utils/clustering.ts` for client-side clustering
   - Extract clustering calculations from component
   - Add proper error handling
2. [ ] Create route optimization utilities:
   - Create `src/utils/routeOptimization.ts`
   - Extract route calculation logic
   - Add distance calculation utilities
   - Implement route sorting algorithms
3. [ ] Separate map utilities:
   - Create `src/utils/mapUtils.ts`
   - Extract map-related calculations
   - Add coordinate transformation utilities
   - Handle map state management
4. [ ] Clean up calculation functions:
   - Review all calculation functions in component
   - Extract to appropriate utility files
   - Add unit tests for calculations
   - Document algorithm choices

Files to Create/Modify:
- `src/utils/clustering.ts` - NEW
- `src/utils/routeOptimization.ts` - NEW
- `src/utils/mapUtils.ts` - NEW
- `src/pages/Delivery/DeliverySpreadsheet.tsx` - Remove inline calculations

### Phase 2: Component Breakdown
Goal: Split large component into manageable pieces

Tasks:
1. [ ] Split delivery spreadsheet:
   - Create `DeliveryTable.tsx` - Table rendering
   - Create `DeliveryFilters.tsx` - Filter/search UI
   - Create `DeliveryActions.tsx` - Action buttons
   - Keep main component as orchestrator
2. [ ] Extract map component:
   - Review `ClusterMap.tsx`
   - Ensure it's properly separated
   - Extract map event handlers
   - Improve map state management
3. [ ] Create driver assignment component:
   - Create `DriverAssignment.tsx`
   - Extract driver selection logic
   - Add driver availability checking
   - Improve assignment UI
4. [ ] Separate route export logic:
   - Review `RouteExport.tsx`
   - Ensure it's properly separated
   - Add export format options
   - Improve error handling

Files to Create/Modify:
- `src/pages/Delivery/components/DeliveryTable.tsx` - NEW
- `src/pages/Delivery/components/DeliveryFilters.tsx` - NEW
- `src/pages/Delivery/components/DeliveryActions.tsx` - NEW
- `src/pages/Delivery/components/DriverAssignment.tsx` - NEW
- `src/pages/Delivery/DeliverySpreadsheet.tsx` - Refactor
- `src/pages/Delivery/ClusterMap.tsx` - Review and improve

### Phase 3: Data Flow
Goal: Improve state management and error handling

Tasks:
1. [ ] Improve state management:
   - Review state structure
   - Consider using `useReducer` for complex state
   - Extract state logic to custom hooks
   - Reduce prop drilling
2. [ ] Add proper error handling:
   - Use `NotificationProvider` for errors
   - Add error boundaries for map component
   - Handle async operation errors
   - Provide user-friendly error messages
3. [ ] Optimize API calls:
   - Review `src/services/delivery-service.ts`
   - Review `src/services/cluster-service.ts`
   - Add request caching where appropriate
   - Implement request debouncing
4. [ ] Better loading states:
   - Use `LoadingIndicator` component
   - Add skeleton loaders
   - Show progress for long operations
   - Handle timeout scenarios

Files to Modify:
- `src/pages/Delivery/DeliverySpreadsheet.tsx`
- `src/services/delivery-service.ts`
- `src/services/cluster-service.ts`
- `src/pages/Delivery/hooks/useDeliveryData.ts` - NEW (if needed)

## Key Files

- `src/pages/Delivery/DeliverySpreadsheet.tsx` (2000+ lines)
- `src/pages/Delivery/ClusterMap.tsx`
- `src/pages/Delivery/RouteExport.tsx`
- `src/pages/Delivery/components/GenerateClustersPopup.tsx`
- `src/services/delivery-service.ts`
- `src/services/cluster-service.ts`
- `src/types/delivery-types.ts`
- `functions-python/clustering.py`

## Success Criteria

- Delivery spreadsheet under 500 lines
- Algorithms in separate utilities
- Clear component separation
- Proper error handling
- Route generation working
- Clustering algorithms accurate
- Map integration functional
- Export features working

## Getting Started

1. Create branch: `git checkout -b clean-code-delivery`
2. Start with Phase 1: Extract algorithms first (foundation)
3. Test incrementally: Test after each algorithm extraction
4. Update this guide: Document progress as you go

Note: This is the most complex refactoring. Consider breaking into smaller PRs:
- PR 1: Algorithm extraction
- PR 2: Component breakdown
- PR 3: Data flow improvements
