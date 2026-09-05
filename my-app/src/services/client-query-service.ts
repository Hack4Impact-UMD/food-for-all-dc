// Read-only query service for the Ad-Hoc Query Tool.
// Translates an allowlisted set of QueryFilter definitions into Firestore constraints,
// executes the query against the selected collection, resolves any configured join to a
// related collection, and applies filters that cannot be expressed as native Firestore
// `where` clauses (e.g. the computed `activeStatus` field on clients).

import { collection, doc, getDoc, getDocs, query, Timestamp, where } from "firebase/firestore";
import { db } from "../auth/firebaseConfig";
import dataSources from "../config/dataSources";
import type { RowData } from "../components/Spreadsheet/export";
import { batchGetClientDeliverySummaries } from "../utils/lastDeliveryDate";
import { ServiceError, formatServiceError } from "../utils/serviceError";
import { COLLECTIONS, CollectionKey, getFieldDef, QueryFilter } from "../types/query-tool-types";
import { mapClientDocToSpreadsheetBaseRow } from "./client-service";
import { deliveryDate } from "../utils/deliveryDate";
import { formatDateMask, normalizeAssignedTime, normalizePhoneNumber } from "../utils/queryToolFormatting";

export interface ClientQueryResult {
  rows: RowData[];
}

const firebaseCollectionName = (collectionKey: string): string =>
  (dataSources.firebase as Record<string, string>)[collectionKey];

// Timestamps are stored with time-of-day precision, but the query tool only lets
// users pick a calendar day. Normalize to that day's local boundaries so "==" means
// "any time during this day" rather than an exact instant.
const parseFilterDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  const raw = String(value);
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(raw);
};

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const startOfNextDay = (date: Date): Date => {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
};

const toFirestoreValue = (collectionKey: CollectionKey, filter: QueryFilter): unknown => {
  const fieldDef = getFieldDef(collectionKey, filter.field);

  if (filter.operator === "in" || filter.operator === "not-in" || filter.operator === "array-contains-any") {
    const values = Array.isArray(filter.value)
      ? filter.value
      : String(filter.value)
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (fieldDef?.type === "number") return values.map((value) => Number(value));
    return values;
  }

  if (fieldDef?.type === "number") return Number(filter.value);
  if (fieldDef?.format === "date" && filter.value instanceof Date) return formatDateMask(filter.value);
  return filter.value;
};

const getRowFieldValue = (row: RowData, field: string): unknown =>
  field.split(".").reduce<unknown>((current, key) => {
    return current && typeof current === "object"
      ? (current as Record<string, unknown>)[key]
      : undefined;
  }, row);

const isClientSideFilter = (collectionKey: CollectionKey, filter: QueryFilter): boolean => {
  const fieldDef = getFieldDef(collectionKey, filter.field);
  if (fieldDef?.computed || fieldDef?.format === "phone") return true;
  // Firestore can only express whole-day ranges on a timestamp; day-equality
  // negation and day lists are resolved against fetched rows instead.
  return (
    fieldDef?.type === "timestamp" && ["!=", "in", "not-in"].includes(filter.operator as string)
  );
};

/**
 * Firestore orders values by type, and every String sorts above every Timestamp.
 * A `>=` range therefore also matches documents whose field is still an
 * unmigrated string, and `<` silently drops them. Verify the stored value is
 * really a timestamp before trusting a range result.
 */
const isStoredTimestamp = (value: unknown): boolean =>
  value instanceof Date ||
  (typeof value === "object" &&
    value !== null &&
    (typeof (value as { toDate?: unknown }).toDate === "function" ||
      typeof (value as { seconds?: unknown }).seconds === "number"));

/** Filters that translate directly into a Firestore `where()` constraint. */
export const getFirestoreFilters = (collectionKey: CollectionKey, filters: QueryFilter[]): QueryFilter[] =>
  filters.filter((filter) => !isClientSideFilter(collectionKey, filter));

/** Filters that must be applied to already-fetched results (e.g. computed fields or normalized phones). */
export const getComputedFilters = (collectionKey: CollectionKey, filters: QueryFilter[]): QueryFilter[] =>
  filters.filter((filter) => isClientSideFilter(collectionKey, filter));

/** Builds the Firestore constraint(s) for a single filter. Timestamp filters expand
 * into whole-day range constraints since the field itself stores an exact instant. */
const buildConstraintsForFilter = (collectionKey: CollectionKey, filter: QueryFilter) => {
  const fieldDef = getFieldDef(collectionKey, filter.field);

  if (fieldDef?.type === "timestamp") {
    const day = parseFilterDate(filter.value);
    const deliveryBounds =
      fieldDef.field === "deliveryDate" ? deliveryDate.getUTCDateBounds(day) : null;
    const dayStart = deliveryBounds?.start ?? startOfDay(day);
    const nextDayStart = deliveryBounds?.endExclusive ?? startOfNextDay(day);
    const dayEnd = deliveryBounds
      ? new Date(nextDayStart.getTime() - 1)
      : endOfDay(day);
    switch (filter.operator) {
      case "==":
        return [
          where(filter.field, ">=", Timestamp.fromDate(dayStart)),
          where(filter.field, "<", Timestamp.fromDate(nextDayStart)),
        ];
      case ">":
        return [where(filter.field, ">", Timestamp.fromDate(dayEnd))];
      case ">=":
        return [where(filter.field, ">=", Timestamp.fromDate(dayStart))];
      case "<":
        return [where(filter.field, "<", Timestamp.fromDate(dayStart))];
      case "<=":
        return [where(filter.field, "<=", Timestamp.fromDate(dayEnd))];
      default:
        return [where(filter.field, filter.operator as any, Timestamp.fromDate(day))];
    }
  }

  return [where(filter.field, filter.operator as any, toFirestoreValue(collectionKey, filter))];
};

export const buildFirestoreConstraints = (collectionKey: CollectionKey, filters: QueryFilter[]) =>
  getFirestoreFilters(collectionKey, filters).flatMap((f) => buildConstraintsForFilter(collectionKey, f));

const matchesComputedFilter = (
  collectionKey: CollectionKey,
  row: RowData,
  filter: QueryFilter
): boolean => {
  const fieldDef = getFieldDef(collectionKey, filter.field);

  if (fieldDef?.type === "timestamp") {
    const actual = deliveryDate.tryToISODateString(getRowFieldValue(row, filter.field) as any);
    const expected = (Array.isArray(filter.value) ? filter.value : [filter.value])
      .map((value) => deliveryDate.tryToISODateString(value as any))
      .filter((value): value is string => Boolean(value));

    if (!actual) return filter.operator === "!=" || filter.operator === "not-in";

    switch (filter.operator) {
      case "!=":
        return actual !== expected[0];
      case "in":
        return expected.includes(actual);
      case "not-in":
        return !expected.includes(actual);
      default:
        return true;
    }
  }

  if (fieldDef?.format === "phone") {
    const actual = normalizePhoneNumber(getRowFieldValue(row, filter.field));
    const expected = (Array.isArray(filter.value) ? filter.value : [filter.value])
      .map(normalizePhoneNumber)
      .filter(Boolean);

    if (filter.operator === "==") return actual === expected[0];
    if (filter.operator === "!=") return actual !== expected[0];
    if (filter.operator === "in") return expected.includes(actual);
    if (filter.operator === "not-in") return !expected.includes(actual);
  }
  if (filter.field === "activeStatus") {
    const expected = filter.value === true || filter.value === "true";
    return Boolean(row.activeStatus) === expected;
  }
  if (filter.field === "deliveryStatus") {
    const actual = row.deliveryStatus === "Missed" ? "Missed" : "Scheduled";
    const expected = Array.isArray(filter.value)
      ? filter.value.map(String)
      : String(filter.value)
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);

    if (filter.operator === "==") return actual === expected[0];
    if (filter.operator === "!=") return actual !== expected[0];
    if (filter.operator === "in") return expected.includes(actual);
    if (filter.operator === "not-in") return !expected.includes(actual);
  }
  if (filter.field === "assignedDriverName") {
    const normalizeDriver = (value: unknown) => String(value ?? "").trim().toLowerCase();
    const actual = normalizeDriver(row.assignedDriverName);
    const expected = Array.isArray(filter.value)
      ? filter.value.map(normalizeDriver)
      : String(filter.value).split(",").map(normalizeDriver).filter(Boolean);

    if (filter.operator === "==") return actual === expected[0];
    if (filter.operator === "!=") return actual !== expected[0];
    if (filter.operator === "in") return expected.includes(actual);
    if (filter.operator === "not-in") return !expected.includes(actual);
  }
  if (filter.field === "cluster") {
    const toRouteNumber = (value: unknown): number => {
      const match = String(value ?? "").match(/\d+/);
      return match ? Number(match[0]) : Number.NaN;
    };
    const actual = toRouteNumber(row.cluster);
    const expectedValues = Array.isArray(filter.value)
      ? filter.value.map(toRouteNumber)
      : String(filter.value).split(",").map(toRouteNumber);
    const expected = expectedValues[0];
    if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
    switch (filter.operator) {
      case "==": return actual === expected;
      case "!=": return actual !== expected;
      case ">": return actual > expected;
      case ">=": return actual >= expected;
      case "<": return actual < expected;
      case "<=": return actual <= expected;
      case "in": return expectedValues.includes(actual);
      case "not-in": return !expectedValues.includes(actual);
      default: return false;
    }
  }
  if (filter.field === "assignedTime") {
    const actual = normalizeAssignedTime(row.time);
    const expectedValues = Array.isArray(filter.value)
      ? filter.value.map(normalizeAssignedTime)
      : String(filter.value).split(",").map(normalizeAssignedTime).filter(Boolean);
    switch (filter.operator) {
      case "==": return actual === expectedValues[0];
      case "!=": return actual !== expectedValues[0];
      case ">": return Number(actual) > Number(expectedValues[0]);
      case ">=": return Number(actual) >= Number(expectedValues[0]);
      case "<": return Number(actual) < Number(expectedValues[0]);
      case "<=": return Number(actual) <= Number(expectedValues[0]);
      case "in": return expectedValues.includes(actual);
      case "not-in": return !expectedValues.includes(actual);
      default: return false;
    }
  }
  if (filter.field === "ward") {
    const normalizeWard = (value: unknown) => {
      const match = String(value ?? "").match(/\d+/);
      return match ? match[0] : "";
    };
    const actual = normalizeWard(row["join.ward"] ?? row.ward);
    const expectedValues = Array.isArray(filter.value)
      ? filter.value.map(normalizeWard)
      : String(filter.value).split(",").map(normalizeWard).filter(Boolean);
    switch (filter.operator) {
      case "==": return actual === expectedValues[0];
      case "!=": return actual !== expectedValues[0];
      case ">": return Number(actual) > Number(expectedValues[0]);
      case ">=": return Number(actual) >= Number(expectedValues[0]);
      case "<": return Number(actual) < Number(expectedValues[0]);
      case "<=": return Number(actual) <= Number(expectedValues[0]);
      case "in": return expectedValues.includes(actual);
      case "not-in": return !expectedValues.includes(actual);
      default: return false;
    }
  }
  return true;
};

const matchesDirectFilter = (collectionKey: CollectionKey, row: RowData, filter: QueryFilter): boolean => {
  const value = getRowFieldValue(row, filter.field);
  const values = Array.isArray(filter.value) ? filter.value : String(filter.value).split(",").map((item) => item.trim());
  const comparable = (item: unknown): string | number => {
    if (getFieldDef(collectionKey, filter.field)?.type === "number") return Number(item);
    if (item && typeof item === "object" && typeof (item as { toDate?: unknown }).toDate === "function") {
      return (item as { toDate: () => Date }).toDate().getTime();
    }
    return String(item ?? "").toLowerCase();
  };
  const actualValues = Array.isArray(value) ? value : [value];
  const actual = comparable(actualValues[0]);
  const expected = values.map(comparable);
  switch (filter.operator) {
    case "==": return actualValues.some((item) => comparable(item) === expected[0]);
    case "!=": return actualValues.every((item) => comparable(item) !== expected[0]);
    case ">": return actual > expected[0];
    case ">=": return actual >= expected[0];
    case "<": return actual < expected[0];
    case "<=": return actual <= expected[0];
    case "in": return expected.includes(actual);
    case "not-in": return !expected.includes(actual);
    case "array-contains": return Array.isArray(value) && value.some((entry) => comparable(entry) === expected[0]);
    case "array-contains-any": return Array.isArray(value) && value.some((entry) => expected.includes(comparable(entry)));
    default: return false;
  }
};

const matchesFilterExpression = (collectionKey: CollectionKey, row: RowData, filters: QueryFilter[]): boolean => {
  const groups: QueryFilter[][] = [[]];
  filters.forEach((filter, index) => {
    if (index > 0 && filter.logic === "OR") groups.push([]);
    groups[groups.length - 1].push(filter);
  });
  return groups.some((group) => group.every((filter) =>
    isClientSideFilter(collectionKey, filter)
      ? matchesComputedFilter(collectionKey, row, filter)
      : matchesDirectFilter(collectionKey, row, filter)
  ));
};

const isIndexRequiredError = (error: unknown): boolean => {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message ?? "";
  return code === "failed-precondition" || /index/i.test(message);
};

const mapRawDocToRow = (collectionKey: CollectionKey, id: string, raw: any): RowData => {
  if (collectionKey === "clients") {
    return {
      ...mapClientDocToSpreadsheetBaseRow(id, raw),
      city: raw.city ?? "",
      state: raw.state ?? "",
      quadrant: raw.quadrant ?? "",
      recurrence: raw.recurrence ?? "",
      total: raw.total ?? null,
      seniors: raw.seniors ?? null,
      updatedAt: raw.updatedAt ?? null,
    };
  }
  return { id, uid: id, ...raw };
};

const enrichDeliveryRouteAssignments = async (rows: RowData[]): Promise<RowData[]> => {
  if (rows.length === 0) return rows;

  let clustersSnapshot;
  try {
    clustersSnapshot = await getDocs(collection(db, dataSources.firebase.clustersCollection));
  } catch {
    return rows;
  }
  if (!clustersSnapshot || !Array.isArray(clustersSnapshot.docs)) return rows;
  type RouteAssignments = {
    clusters: Array<{ id?: unknown; deliveries?: unknown[]; driver?: unknown; time?: unknown }>;
    clientOverrides: Array<{ clientId?: unknown; driver?: unknown; time?: unknown }>;
  };
  const assignmentsByDate = new Map<string, RouteAssignments>();

  const getClusterDateKey = (value: unknown): string | null => {
    const date = typeof Timestamp === "function" && value instanceof Timestamp
      ? value.toDate()
      : value && typeof value === "object" && typeof (value as { toDate?: unknown }).toDate === "function"
        ? (value as { toDate: () => Date }).toDate()
        : null;
    if (date && !Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
    return deliveryDate.tryToISODateString(value as Parameters<typeof deliveryDate.tryToISODateString>[0]);
  };

  clustersSnapshot.docs.forEach((clusterDocument) => {
    const data = clusterDocument.data();
    const dateKey = getClusterDateKey(data.date);
    if (!dateKey) return;
    const assignments = {
      clusters: Array.isArray(data.clusters) ? data.clusters : [],
      clientOverrides: Array.isArray(data.clientOverrides) ? data.clientOverrides : [],
    };
    assignmentsByDate.set(dateKey, assignments);
  });

  const normalizeId = (value: unknown) => String(value ?? "").trim();
  const findAssignment = (
    assignments: RouteAssignments | undefined,
    clientId: string
  ) => {
    if (!assignments) return undefined;
    return assignments.clusters.find((candidate) =>
      Array.isArray(candidate.deliveries) && candidate.deliveries.some((deliveryId) => {
        const normalizedDeliveryId =
          deliveryId && typeof deliveryId === "object" && "id" in deliveryId
            ? (deliveryId as { id?: unknown }).id
            : deliveryId;
        return normalizeId(normalizedDeliveryId) === clientId;
      })
    );
  };

  return rows.map((row) => {
    const dateKey = deliveryDate.tryToISODateString(row.deliveryDate);
    const assignments = dateKey ? assignmentsByDate.get(dateKey) : undefined;
    if (!assignments) return row;

    const clientId = normalizeId(row.clientId ?? row.clientid ?? row.uid);
    const cluster = findAssignment(assignments, clientId);
    const override = assignments.clientOverrides.find(
      (candidate) => normalizeId(candidate.clientId) === clientId
    );
    const driver = override?.driver || cluster?.driver;
    return {
      ...row,
      cluster: cluster?.id ?? row.cluster,
      assignedDriverName:
        typeof driver === "string" ? driver : (driver as { name?: string } | undefined)?.name ?? row.assignedDriverName,
      time: override?.time || cluster?.time || row.time,
    };
  });
};

/** Fetches allowlisted join fields for a batch of related document ids. */
async function fetchJoinedFields(
  targetCollectionName: string,
  ids: string[],
  fields: { field: string }[]
): Promise<Map<string, Record<string, unknown>>> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const result = new Map<string, Record<string, unknown>>();

  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, targetCollectionName, id));
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, unknown>;
        const picked: Record<string, unknown> = {};
        fields.forEach((f) => {
          picked[f.field] = data[f.field];
        });
        result.set(id, picked);
      } catch {
        // Skip unresolved joins; the base row is still shown without the joined fields.
      }
    })
  );

  return result;
}

export async function runClientQuery(
  collectionKey: CollectionKey,
  filters: QueryFilter[]
): Promise<ClientQueryResult> {
  try {
    const collectionDef = COLLECTIONS[collectionKey];
    const hasOrLogic = filters.some((filter, index) => index > 0 && filter.logic === "OR");
    const disjunctiveFilterCount = filters.filter((filter) =>
      ["in", "not-in", "array-contains", "array-contains-any"].includes(filter.operator)
    ).length;
    const requiresClientSideExpression = hasOrLogic || disjunctiveFilterCount > 1;
    const constraints = requiresClientSideExpression ? [] : buildFirestoreConstraints(collectionKey, filters);
    const q = query(
      collection(db, firebaseCollectionName(collectionDef.collectionKey)),
      ...constraints
    );

    const snapshot = await getDocs(q);
    // Range constraints on a timestamp field also match unmigrated string values,
    // so verify against the raw document before mapping.
    const rangeTimestampFields = getFirestoreFilters(collectionKey, filters)
      .filter(
        (filter) =>
          getFieldDef(collectionKey, filter.field)?.type === "timestamp" &&
          [">", ">=", "<", "<=", "=="].includes(filter.operator as string)
      )
      .map((filter) => filter.field);

    const matchedDocs =
      rangeTimestampFields.length === 0
        ? snapshot.docs
        : snapshot.docs.filter((docSnap) =>
            rangeTimestampFields.every((field) =>
              isStoredTimestamp(getRowFieldValue(docSnap.data() as RowData, field))
            )
          );

    let rows: RowData[] = matchedDocs.map((docSnap) =>
      mapRawDocToRow(collectionKey, docSnap.id, docSnap.data())
    );

    if (collectionKey === "deliveries") {
      rows = await enrichDeliveryRouteAssignments(rows);
    }

    if (collectionKey === "clients" && rows.length > 0) {
      const deliverySummaries = await batchGetClientDeliverySummaries(rows.map((r) => r.uid));
      rows = rows.map((row) => ({
        ...row,
        lastDeliveryDate: deliverySummaries.get(row.uid)?.lastDeliveryDate ?? "",
        missedStrikeCount: deliverySummaries.get(row.uid)?.missedStrikeCount ?? 0,
      }));
    }

    if (collectionDef.join && rows.length > 0) {
      const { join } = collectionDef;
      const targetCollectionName = firebaseCollectionName(join.targetCollectionKey);
      const joinedById = await fetchJoinedFields(
        targetCollectionName,
        rows.map((r) => String(r[join.localIdField] ?? "")),
        join.fields
      );
      rows = rows.map((row) => {
        const joinedData = joinedById.get(String(row[join.localIdField] ?? ""));
        if (!joinedData) return row;
        const joinedRow: RowData = { ...row };
        join.fields.forEach((f) => {
          joinedRow[`join.${f.field}`] = joinedData[f.field];
        });
        return joinedRow;
      });
    }

    const computedFilters = getComputedFilters(collectionKey, filters);
    if (requiresClientSideExpression) {
      rows = rows.filter((row) => matchesFilterExpression(collectionKey, row, filters));
    } else if (computedFilters.length > 0) {
      rows = rows.filter((row) =>
        computedFilters.every((filter) => matchesComputedFilter(collectionKey, row, filter))
      );
    }

    // Query metadata only (no row contents/PII) — safe to log for troubleshooting.
    console.info("Query executed", {
      collection: collectionKey,
      filterCount: filters.length,
      resultCount: rows.length,
    });

    return { rows };
  } catch (error) {
    if (isIndexRequiredError(error)) {
      console.error("Query requires a composite index", {
        collection: collectionKey,
        message: (error as { message?: string })?.message,
      });
      throw new ServiceError(
        "This combination of filters requires an additional database index. Please contact an administrator.",
        "failed-precondition"
      );
    }
    throw formatServiceError(error, "Failed to run query. Please try again.");
  }
}
