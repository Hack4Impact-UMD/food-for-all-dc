// Types for the read-only Client Query Tool (Ad-Hoc Query Tool)
// Field allowlist + filter/query model shared by the UI and the query service.

export type QueryFieldType = "boolean" | "number" | "text" | "textList" | "timestamp";
export type QueryFieldFormat = "phone" | "date";

export type QueryOperator =
  | "=="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "in"
  | "not-in"
  | "array-contains"
  | "array-contains-any";

export interface QueryFieldDef {
  /** Exact Firestore field name (dot-path for nested fields). */
  field: string;
  /** Friendly label shown in the UI. */
  label: string;
  type: QueryFieldType;
  /** True when the value cannot be filtered via a native Firestore `where` clause
   * (e.g. `activeStatus` is derived at read time from startDate/endDate/autoInactiveReason)
   * and must instead be applied to already-fetched results. */
  computed?: boolean;
  /** Optional fixed set of allowed values, rendered as a select instead of free text. */
  options?: string[];
  /** Delivery times are meaningful; other timestamp fields represent calendar days. */
  timeSensitive?: boolean;
  format?: QueryFieldFormat;
}

export interface QueryFilter {
  id: string;
  field: string;
  operator: QueryOperator | "";
  logic?: "AND" | "OR";
  /** string | number | boolean | string[] | Date */
  value: unknown;
}

export const OPERATORS_BY_TYPE: Record<QueryFieldType, QueryOperator[]> = {
  boolean: ["=="],
  number: ["==", "!=", ">", ">=", "<", "<=", "in", "not-in"],
  text: ["==", "!=", "in", "not-in"],
  textList: ["array-contains", "array-contains-any"],
  timestamp: ["==", ">", ">=", "<", "<="],
};

export const OPERATOR_LABELS: Record<QueryOperator, string> = {
  "==": "equals",
  "!=": "not equals",
  ">": "greater than",
  ">=": "greater than or equal to",
  "<": "less than",
  "<=": "less than or equal to",
  in: "is any of",
  "not-in": "is none of",
  "array-contains": "contains",
  "array-contains-any": "contains any of",
};

const WARD_OPTIONS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
];

const QUADRANT_OPTIONS = ["NE", "NW", "SE", "SW"];

/** A field pulled in from a related collection via a join, shown alongside the row's own fields. */
export interface JoinFieldDef {
  /** Field name on the joined document. */
  field: string;
  label: string;
}

export interface JoinDef {
  /** Field on the source row holding the id of the related document (e.g. "clientId"). */
  localIdField: string;
  /** dataSources.firebase key resolving to the related Firestore collection name. */
  targetCollectionKey: string;
  /** Label for the joined section, e.g. "Client". */
  label: string;
  /** Fields to pull from the related document and show as extra "joined" columns. */
  fields: JoinFieldDef[];
}

export type CollectionKey =
  | "clients"
  | "deliveries"
  | "drivers"
  | "referralOrganizations"
  | "users";

export interface CollectionDef {
  key: CollectionKey;
  label: string;
  /** dataSources.firebase key resolving to the actual Firestore collection name. */
  collectionKey: string;
  /** Allowlisted, filterable fields for this collection. */
  fields: QueryFieldDef[];
  /** Fields (in order) used to build a friendly "Name" column for results, joined with ", ". */
  nameFields: string[];
  /** Optional join to a related collection to enrich results with related data. */
  join?: JoinDef;
}

// Do NOT add free-text/sensitive fields (notes, lifeChallenges, lifestyleGoals,
// health conditions, delivery instructions) to any collection below.
const CLIENT_FIELDS: QueryFieldDef[] = [
  { field: "activeStatus", label: "Active Status", type: "boolean", computed: true },
  { field: "firstName", label: "First Name", type: "text" },
  { field: "lastName", label: "Last Name", type: "text" },
  { field: "city", label: "City", type: "text" },
  { field: "state", label: "State", type: "text" },
  { field: "zipCode", label: "ZIP Code", type: "text" },
  { field: "address2", label: "Address 2", type: "text" },
  { field: "quadrant", label: "Quadrant", type: "text", options: QUADRANT_OPTIONS },
  { field: "ward", label: "Ward", type: "number", computed: true, options: WARD_OPTIONS },
  { field: "language", label: "Language", type: "text" },
  { field: "gender", label: "Gender", type: "text" },
  { field: "ethnicity", label: "Ethnicity", type: "text" },
  { field: "headOfHousehold", label: "Head of Household", type: "text" },
  { field: "email", label: "Email", type: "text" },
  { field: "alternativePhone", label: "Alternative Phone", type: "text", format: "phone" },
  { field: "deliveryFreq", label: "Delivery Frequency", type: "text" },
  { field: "recurrence", label: "Recurrence", type: "text" },
  { field: "tefapCert", label: "TEFAP Certified", type: "boolean" },
  { field: "tags", label: "Tags", type: "textList" },
  { field: "total", label: "Household Size", type: "number" },
  { field: "adults", label: "Adults", type: "number" },
  { field: "children", label: "Children", type: "number" },
  { field: "seniors", label: "Seniors", type: "number" },
  { field: "referralEntity.organization", label: "Referral Organization", type: "text" },
  { field: "referralEntity.name", label: "Referral Contact", type: "text" },
  { field: "famStartDate", label: "FAM Start Date", type: "text", format: "date" },
  { field: "startDate", label: "Start Date", type: "text", format: "date" },
  { field: "endDate", label: "End Date", type: "text", format: "date" },
  { field: "tefapCertDate", label: "TEFAP Certification Date", type: "text", format: "date" },
  { field: "dob", label: "Date of Birth", type: "text", format: "date" },
  { field: "referredDate", label: "Referral Date", type: "text", format: "date" },
  { field: "updatedAt", label: "Last Updated", type: "timestamp", format: "date" },
];

const DELIVERY_FIELDS: QueryFieldDef[] = [
  { field: "clientName", label: "Client Name", type: "text" },
  { field: "assignedDriverName", label: "Driver", type: "text", computed: true },
  { field: "assignedTime", label: "Assigned Time", type: "text", computed: true },
  { field: "ward", label: "Ward", type: "number", computed: true },
  { field: "recurrence", label: "Recurrence", type: "text" },
  { field: "cluster", label: "Cluster", type: "number", computed: true },
  {
    field: "deliveryStatus",
    label: "Delivery Status",
    type: "text",
    computed: true,
    options: ["Scheduled", "Missed"],
  },
  { field: "deliveryDate", label: "Delivery Date", type: "timestamp", format: "date" },
];

const DRIVER_FIELDS: QueryFieldDef[] = [
  { field: "name", label: "Name", type: "text" },
  { field: "phone", label: "Phone", type: "text", format: "phone" },
  { field: "email", label: "Email", type: "text" },
];

const REFERRAL_ORG_FIELDS: QueryFieldDef[] = [
  { field: "name", label: "Contact Name", type: "text" },
  { field: "organization", label: "Organization", type: "text" },
  { field: "phone", label: "Phone", type: "text", format: "phone" },
  { field: "email", label: "Email", type: "text" },
];

const USER_FIELDS: QueryFieldDef[] = [
  { field: "name", label: "Name", type: "text" },
  { field: "role", label: "Role", type: "text" },
  { field: "email", label: "Email", type: "text" },
  { field: "phone", label: "Phone", type: "text", format: "phone" },
];

// Registry of every collection exposed to the Ad-Hoc Query Tool.
// Adding a collection here is the only step needed to make it queryable —
// there is no generic/arbitrary-field escape hatch.
export const COLLECTIONS: Record<CollectionKey, CollectionDef> = {
  clients: {
    key: "clients",
    label: "Clients",
    collectionKey: "clientsCollection",
    fields: CLIENT_FIELDS,
    nameFields: ["lastName", "firstName"],
  },
  deliveries: {
    key: "deliveries",
    label: "Routes",
    collectionKey: "calendarCollection",
    fields: DELIVERY_FIELDS,
    nameFields: ["clientName"],
    // Deliveries only store clientId/clientName; join back to the client profile
    // so ops staff can see ward/ZIP/tags without a second lookup.
    join: {
      localIdField: "clientId",
      targetCollectionKey: "clientsCollection",
      label: "Client",
      fields: [
        { field: "ward", label: "Client Ward" },
        { field: "zipCode", label: "Client ZIP Code" },
        { field: "tags", label: "Client Tags" },
      ],
    },
  },
  drivers: {
    key: "drivers",
    label: "Drivers",
    collectionKey: "driversCollection",
    fields: DRIVER_FIELDS,
    nameFields: ["name"],
  },
  referralOrganizations: {
    key: "referralOrganizations",
    label: "Referral Organizations",
    collectionKey: "caseWorkersCollection",
    fields: REFERRAL_ORG_FIELDS,
    nameFields: ["name"],
  },
  users: {
    key: "users",
    label: "Users",
    collectionKey: "usersCollection",
    fields: USER_FIELDS,
    nameFields: ["name"],
  },
};

export const COLLECTION_KEYS = Object.keys(COLLECTIONS) as CollectionKey[];

/** @deprecated kept for backward compatibility — use COLLECTIONS.clients.fields */
export const QUERYABLE_FIELDS = CLIENT_FIELDS;

export const getFieldDef = (
  collectionKeyOrField: CollectionKey | string,
  maybeField?: string
): QueryFieldDef | undefined => {
  // Backward-compatible overload: getFieldDef(field) defaults to the clients collection.
  if (maybeField === undefined) {
    return CLIENT_FIELDS.find((f) => f.field === collectionKeyOrField);
  }
  const collectionDef = COLLECTIONS[collectionKeyOrField as CollectionKey];
  return collectionDef?.fields.find((f) => f.field === maybeField);
};


export const createEmptyFilter = (): QueryFilter => ({
  id:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `filter-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  field: "",
  operator: "",
  logic: "AND",
  value: "",
});
