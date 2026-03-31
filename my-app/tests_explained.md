# Tests Explained

This document summarizes every current test file and every test case in the project, including:
- what behavior each test validates,
- which app feature/flow it protects,
- and which source file/function it targets.

## Quick Index By Domain

### Calendar
- [src/pages/Calendar/components/capacityStatus.test.ts](#src-pages-calendar-components-capacitystatus-test-ts)
- [src/pages/Calendar/components/calendarDateRange.test.ts](#src-pages-calendar-components-calendardaterange-test-ts)

### Delivery
- [src/pages/Delivery/ClusterMap.test.ts](#src-pages-delivery-clustermap-test-ts)
- [src/pages/Delivery/DeliverySpreadsheet.styles.test.ts](#src-pages-delivery-deliveryspreadsheet-styles-test-ts)
- [src/pages/Delivery/utils/routeAssignmentState.test.ts](#src-pages-delivery-utils-routeassignmentstate-test-ts)

### Services
- [src/services/delivery-service.test.ts](#src-services-delivery-service-test-ts)
- [src/services/delivery-service.enforceEndDate.test.ts](#src-services-delivery-service-enforceenddate-test-ts)

### Utils
- [src/utils/searchFilter.test.ts](#src-utils-searchfilter-test-ts)
- [src/utils/recurringSeries.test.ts](#src-utils-recurringseries-test-ts)
- [src/utils/lastDeliveryDate.test.ts](#src-utils-lastdeliverydate-test-ts)
- [src/utils/dates.test.ts](#src-utils-dates-test-ts)
- [src/utils/sorting.test.ts](#src-utils-sorting-test-ts)
- [src/utils/csvExport.test.ts](#src-utils-csvexport-test-ts)
- [src/utils/exportFormatters.test.ts](#src-utils-exportformatters-test-ts)
- [src/utils/clientStatus.test.ts](#src-utils-clientstatus-test-ts)

<a id="src-services-delivery-service-test-ts"></a>
## 1) src/services/delivery-service.test.ts

### Suite: DeliveryService.scheduleClientDeliveries
- does nothing when all requested dates already exist
  - Purpose: Ensures add-flow idempotency when all requested dates are duplicates.
  - App area: Calendar add-delivery flow.
  - Targets: src/services/delivery-service.ts -> scheduleClientDeliveries.

- adds only missing dates when requested dates include existing ones
  - Purpose: Confirms additive behavior; only missing dates are created.
  - App area: Calendar add-delivery with mixed existing/new custom dates.
  - Targets: src/services/delivery-service.ts -> scheduleClientDeliveries.

- never uses destructive replacement path when creating multiple new dates
  - Purpose: Guards against delete-and-recreate regressions.
  - App area: Weekly recurrence creation in scheduling UI.
  - Targets: src/services/delivery-service.ts -> scheduleClientDeliveries.

### Suite: DeliveryService.calculateDeliveryDateKeys
- normalizes custom dates into unique sorted ISO keys
  - Purpose: Deduplicates, validates, and sorts custom dates.
  - App area: Custom recurrence date selection.
  - Targets: src/services/delivery-service.ts -> calculateDeliveryDateKeys.

- returns a single normalized date key for one-off deliveries
  - Purpose: Verifies one-time deliveries yield exactly one normalized date key.
  - App area: Single delivery creation.
  - Targets: src/services/delivery-service.ts -> calculateDeliveryDateKeys.

- expands weekly recurrence through repeatsEndDate inclusive
  - Purpose: Ensures weekly date expansion stops at the inclusive end date.
  - App area: Recurring schedule generation.
  - Targets: src/services/delivery-service.ts -> calculateDeliveryDateKeys.

- returns an empty array when the non-custom start date is invalid
  - Purpose: Prevents malformed scheduling writes from invalid dates.
  - App area: Delivery creation validation.
  - Targets: src/services/delivery-service.ts -> calculateDeliveryDateKeys.

### Suite: DeliveryService.reconcileClusterState
- reconciles cluster deliveries by trimming, filtering, and deduplicating client assignments
  - Purpose: Cleans route cluster membership data and removes invalid/duplicate assignments.
  - App area: Delivery route map/spreadsheet cluster consistency.
  - Targets: src/services/delivery-service.ts -> reconcileClusterState.

- normalizes and filters client overrides to valid active client entries
  - Purpose: Preserves only meaningful overrides for active clients.
  - App area: Route assignment override persistence.
  - Targets: src/services/delivery-service.ts -> reconcileClusterState.

- sets reviewRequired only when assignments existed and active clients are left unassigned
  - Purpose: Flags only true reassignment-risk conditions.
  - App area: Post-change route review signaling.
  - Targets: src/services/delivery-service.ts -> reconcileClusterState.

### Suite: DeliveryService.resolveSeriesForEvent
- returns only the anchor event for single scope
  - Purpose: Ensures single-event edits/deletes do not expand scope.
  - App area: Calendar recurrence edit/delete with scope = single.
  - Targets: src/services/delivery-service.ts -> resolveSeriesForEvent.

- returns anchor-and-future events for following scope
  - Purpose: Ensures this-and-following operations include only anchor+future events.
  - App area: Calendar recurrence edit/delete with scope = following.
  - Targets: src/services/delivery-service.ts -> resolveSeriesForEvent.

- throws repair-required error when anchor event is missing from scoped following events
  - Purpose: Prevents ambiguous mutation against inconsistent series data.
  - App area: Recurring series safety checks.
  - Targets: src/services/delivery-service.ts -> resolveSeriesForEvent.

<a id="src-services-delivery-service-enforceenddate-test-ts"></a>
## 2) src/services/delivery-service.enforceEndDate.test.ts

### Suite: DeliveryService.enforceClientEndDate
- deletes future deliveries beyond end date and emits delete change event
  - Purpose: Verifies future deliveries are pruned and delete event is emitted.
  - App area: Profile end-date changes affecting scheduled deliveries.
  - Targets: src/services/delivery-service.ts -> enforceClientEndDate.

- updates repeatsEndDate for recurring events and emits update change event
  - Purpose: Verifies recurring metadata is trimmed when no deletions are needed.
  - App area: Recurring schedule adjustments from profile updates.
  - Targets: src/services/delivery-service.ts -> enforceClientEndDate.

- returns early when new end date is not earlier than previous end date
  - Purpose: Confirms no-op guard prevents unnecessary reads/writes.
  - App area: Profile edit flows with unchanged/extended end date.
  - Targets: src/services/delivery-service.ts -> enforceClientEndDate.

<a id="src-pages-delivery-clustermap-test-ts"></a>
## 3) src/pages/Delivery/ClusterMap.test.ts

### Suite: ClusterMap popup regression guards
- keeps explicit popup options to prevent immediate close
  - Purpose: Prevents popup close-on-click regressions.
  - App area: Delivery map marker popup interaction.
  - Targets: src/pages/Delivery/ClusterMap.tsx popup options.

- opens marker popup directly on marker click
  - Purpose: Ensures both direct marker click and programmatic open paths call openPopup.
  - App area: Delivery map popups from marker/table interactions.
  - Targets: src/pages/Delivery/ClusterMap.tsx click/openMapPopup handlers.

<a id="src-pages-delivery-deliveryspreadsheet-styles-test-ts"></a>
## 4) src/pages/Delivery/DeliverySpreadsheet.styles.test.ts

### Suite: DeliverySpreadsheet styles regression
- does not apply global html/body centering styles
  - Purpose: Prevents global CSS from shifting route page layout.
  - App area: Routes page layout and map/search placement.
  - Targets: src/pages/Delivery/DeliverySpreadsheet.css.

<a id="src-pages-delivery-utils-routeassignmentstate-test-ts"></a>
## 5) src/pages/Delivery/utils/routeAssignmentState.test.ts

### Suite: routeAssignmentState helpers
- detects conflicting route slots for touched routes
  - Purpose: Validates conflict detection for duplicate driver+time route slots.
  - App area: Delivery route assignment conflict UX.
  - Targets: src/pages/Delivery/utils/routeAssignmentState.ts -> findRouteSlotConflict.

- assigns drivers to selected routes and clears affected client driver overrides
  - Purpose: Verifies route-level driver assignment and stale override cleanup.
  - App area: Bulk driver assignment in route tools.
  - Targets: src/pages/Delivery/utils/routeAssignmentState.ts -> assignDriverToRoutes.

- assigns times to selected routes and clears affected client time overrides
  - Purpose: Verifies route-level time assignment and stale override cleanup.
  - App area: Bulk time assignment in route tools.
  - Targets: src/pages/Delivery/utils/routeAssignmentState.ts -> assignTimeToRoutes.

- moves a client between clusters and removes that client override
  - Purpose: Verifies cluster membership transfer and override cleanup on move.
  - App area: Drag/drop or control-based client route reassignment.
  - Targets: src/pages/Delivery/utils/routeAssignmentState.ts -> moveClientToCluster.

- updates route-level driver/time and clears matching overrides for clients in target route
  - Purpose: Verifies route-level updates remove redundant per-client overrides.
  - App area: Route editing from map/table controls.
  - Targets: src/pages/Delivery/utils/routeAssignmentState.ts -> updateClientRouteAssignment.

<a id="src-pages-calendar-components-capacitystatus-test-ts"></a>
## 6) src/pages/Calendar/components/capacityStatus.test.ts

### Suite: capacityStatus helpers
- uses date-specific daily limit over weekly defaults
  - Purpose: Confirms daily override precedence over weekly limits.
  - App area: Calendar capacity display logic.
  - Targets: src/pages/Calendar/components/capacityStatus.ts -> resolveLimitForDate.

- falls back to array-based weekly limit when no daily override exists
  - Purpose: Confirms weekly array index mapping by day works.
  - App area: Capacity fallback logic.
  - Targets: src/pages/Calendar/components/capacityStatus.ts -> resolveLimitForDate.

- classifies counts into normal, near, at, and over statuses
  - Purpose: Verifies status bucket thresholds.
  - App area: Capacity badges/chips/warnings.
  - Targets: src/pages/Calendar/components/capacityStatus.ts -> getCapacityStatus.

- builds sorted projected warnings and omits normal-capacity dates
  - Purpose: Ensures warning list is concise and date-sorted.
  - App area: Pre-save projected capacity warnings.
  - Targets: src/pages/Calendar/components/capacityStatus.ts -> buildProjectedCapacityWarnings.

- clamps projected counts to zero when clampProjectedCountToZero is enabled
  - Purpose: Prevents negative projected counts from appearing.
  - App area: Capacity warning calculations on deletions.
  - Targets: src/pages/Calendar/components/capacityStatus.ts -> buildProjectedCapacityWarnings.

<a id="src-pages-calendar-components-calendardaterange-test-ts"></a>
## 7) src/pages/Calendar/components/calendarDateRange.test.ts

### Suite: getCalendarViewRange
- returns one-day inclusive/exclusive bounds for Day view
  - Purpose: Verifies day queries are exactly one day wide.
  - App area: Day calendar fetch window.
  - Targets: src/pages/Calendar/components/calendarDateRange.ts -> getCalendarViewRange (Day).

- returns expanded month grid bounds with two-week padding
  - Purpose: Verifies month prefetch padding around visible grid.
  - App area: Month calendar fetch window.
  - Targets: src/pages/Calendar/components/calendarDateRange.ts -> getCalendarViewRange (Month).

- keeps month range anchored to Sunday/Saturday week alignment
  - Purpose: Verifies month grid aligns to Sunday-start/Saturday-end assumptions.
  - App area: Month grid rendering alignment.
  - Targets: src/pages/Calendar/components/calendarDateRange.ts -> getCalendarViewRange.

<a id="src-utils-searchfilter-test-ts"></a>
## 8) src/utils/searchFilter.test.ts

### Suite: searchFilter parsing
- splits plain space-separated terms
  - Purpose: Confirms standard tokenization for free-text search.
  - App area: Routes page search input parsing.
  - Targets: src/utils/searchFilter.ts -> parseSearchTermsProgressively.

- keeps quoted phrases as a single search term
  - Purpose: Preserves phrase integrity in query parsing.
  - App area: Routes search for names/addresses with spaces.
  - Targets: src/utils/searchFilter.ts -> parseSearchTermsProgressively.

- preserves key:value terms when value is quoted and contains spaces
  - Purpose: Keeps key-based quoted values together.
  - App area: Structured search syntax in Routes filtering.
  - Targets: src/utils/searchFilter.ts -> parseSearchTermsProgressively.

- extracts normalized keyword and unquoted value from key-value terms
  - Purpose: Verifies normalized keyword/value extraction for filter switch logic.
  - App area: Keyed search fields (name, ward, driver, etc.).
  - Targets: src/utils/searchFilter.ts -> extractKeyValue.

- returns non-key-value metadata when no colon exists
  - Purpose: Ensures plain text terms are not misclassified as key-value.
  - App area: Free-text fallback filter logic.
  - Targets: src/utils/searchFilter.ts -> extractKeyValue.

<a id="src-utils-recurringseries-test-ts"></a>
## 9) src/utils/recurringSeries.test.ts

### Suite: recurringSeries
- keeps separate recurring series split by recurrenceId
  - Purpose: Ensures recurrenceId partitions series correctly.
  - App area: Recurring series listing/summaries.
  - Targets: src/utils/recurringSeries.ts -> summarizeDeliverySeries.

- uses recurrenceId as the series key and blocks legacy future mutations
  - Purpose: Verifies unresolved legacy recurring events are mutation-safe blocked.
  - App area: Future-scope recurrence mutation safety.
  - Targets: src/utils/recurringSeries.ts -> getDeliverySeriesKey, canMutateFutureSeries, buildSeriesSummary.

- returns the latest scheduled date for custom and one-off deliveries
  - Purpose: Ensures latest date calculations cover mixed recurrence types.
  - App area: Profile latest scheduled date display.
  - Targets: src/utils/recurringSeries.ts -> getLatestScheduledDate.

- flags missing recurrenceIds and overlapping recurring series
  - Purpose: Verifies recurrence audit catches data integrity risks.
  - App area: Recurrence diagnostics/audit reporting.
  - Targets: src/utils/recurringSeries.ts -> buildRecurringSeriesAuditReport.

<a id="src-utils-lastdeliverydate-test-ts"></a>
## 10) src/utils/lastDeliveryDate.test.ts

### Suite: batchGetClientDeliverySummaries
- chunks large client lists into firestore-safe in queries
  - Purpose: Ensures batching respects Firestore in-query limits.
  - App area: Bulk profile/delivery summary retrieval.
  - Targets: src/utils/lastDeliveryDate.ts -> batchGetClientDeliverySummaries.

- selects the latest delivery date per client
  - Purpose: Ensures per-client summaries track max delivery date.
  - App area: Delivery history and status surfaces.
  - Targets: src/utils/lastDeliveryDate.ts -> batchGetClientDeliverySummaries.

- aggregates missed strike counts per client
  - Purpose: Ensures missed delivery totals are counted correctly.
  - App area: Three-strikes/client status logic inputs.
  - Targets: src/utils/lastDeliveryDate.ts -> batchGetClientDeliverySummaries.

<a id="src-utils-dates-test-ts"></a>
## 11) src/utils/dates.test.ts

### Suite: validateDateInput
- accepts valid MM/DD/YYYY input
  - Purpose: Validates accepted user-entered date format.
  - App area: Profile and scheduling forms.
  - Targets: src/utils/dates.ts -> validateDateInput.

- accepts valid YYYY-MM-DD input and normalizes to MM/DD/YYYY
  - Purpose: Verifies compatibility with HTML date input values.
  - App area: Form interoperability between date input types.
  - Targets: src/utils/dates.ts -> validateDateInput.

- rejects impossible dates such as February 30
  - Purpose: Rejects non-existent calendar dates.
  - App area: Input validation before persistence.
  - Targets: src/utils/dates.ts -> validateDateInput.

- enforces configurable year boundaries
  - Purpose: Verifies min/max year guards.
  - App area: Date constraints in profile/business rules.
  - Targets: src/utils/dates.ts -> validateDateInput.

<a id="src-utils-sorting-test-ts"></a>
## 12) src/utils/sorting.test.ts

### Suite: sorting utilities
- sorts by nested key paths
  - Purpose: Verifies nested key sorting for object fields.
  - App area: Table sorting in delivery/profile views.
  - Targets: src/utils/sorting.ts -> sortData.

- handles null and undefined consistently
  - Purpose: Verifies stable ordering for sparse data.
  - App area: Table sorting with incomplete records.
  - Targets: src/utils/sorting.ts -> compareValues via sortData.

- sorts number/date/boolean-like values using semantic comparisons
  - Purpose: Verifies current coercion behavior for numeric/date/boolean-like strings.
  - App area: Mixed-type column sorting.
  - Targets: src/utils/sorting.ts -> normalizeValue + compareValues via sortData.

- applies multi-column sorting with deterministic tie-breakers
  - Purpose: Verifies secondary key tie-break behavior.
  - App area: Multi-column sorting in spreadsheet-like views.
  - Targets: src/utils/sorting.ts -> sortDataMultiple.

<a id="src-utils-csvexport-test-ts"></a>
## 13) src/utils/csvExport.test.ts

### Suite: csvExport safety utilities
- sanitizes invalid filename characters and control characters
  - Purpose: Ensures download filenames are safe across OS/browser contexts.
  - App area: CSV export download flow.
  - Targets: src/utils/csvExport.ts -> sanitizeFilename.

- escapes dangerous formula prefixes
  - Purpose: Prevents CSV formula injection from user-controlled fields.
  - App area: CSV export safety.
  - Targets: src/utils/csvExport.ts -> escapeCsvFormulaValue.

- normalizes complex row values into safe CSV scalars
  - Purpose: Verifies arrays/objects/dates/nulls normalize correctly and safely.
  - App area: CSV serialization input preprocessing.
  - Targets: src/utils/csvExport.ts -> normalizeCsvRows (and normalizeCsvValue).

<a id="src-utils-exportformatters-test-ts"></a>
## 14) src/utils/exportFormatters.test.ts

### Suite: formatDietaryRestrictionsForExport
- includes labels for enabled boolean dietary restrictions
  - Purpose: Verifies boolean flag to label mapping.
  - App area: Dietary columns in exports.
  - Targets: src/utils/exportFormatters.ts -> formatDietaryRestrictionsForExport.

- appends allergens and custom dietary text fields
  - Purpose: Verifies inclusion/order of allergens and free-text values.
  - App area: Client dietary export output.
  - Targets: src/utils/exportFormatters.ts -> formatDietaryRestrictionsForExport.

- returns None when restrictions are missing or empty
  - Purpose: Verifies stable fallback for absent dietary data.
  - App area: Export formatting robustness.
  - Targets: src/utils/exportFormatters.ts -> formatDietaryRestrictionsForExport.

<a id="src-utils-clientstatus-test-ts"></a>
## 15) src/utils/clientStatus.test.ts

### Suite: clientStatus utilities
- treats start/end boundaries as inclusive in active status computation
  - Purpose: Verifies active/inactive calculation on date boundaries.
  - App area: Profile/calendar active status display.
  - Targets: src/utils/clientStatus.ts -> computeClientActiveStatus.

- forces inactive status for three-strikes auto-inactive reason
  - Purpose: Verifies three-strikes override supersedes date-range eligibility.
  - App area: Automated client inactivity policy.
  - Targets: src/utils/clientStatus.ts -> computeClientActiveStatus.

- maps active status and missed strikes to expected presentation states
  - Purpose: Verifies color/tooltip/strike presentation mapping.
  - App area: Status icon/chip rendering in profile/calendar surfaces.
  - Targets: src/utils/clientStatus.ts -> getClientStatusPresentation.

---

## Coverage Snapshot
- Test files documented: 15
- Individual test cases documented: 61
- Scope: all currently discovered `*.test.ts` / `*.test.tsx` files under `my-app/src`
