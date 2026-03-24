import { DateTime } from "luxon";
import { Timestamp } from "firebase/firestore";
import { SummaryData } from "../../types/reports-types";
import { HouseholdSnapshot } from "../../types/delivery-types";
import TimeUtils from "../../utils/timeUtils";
import { buildHouseholdSnapshot, normalizeHouseholdSnapshot } from "../../utils/householdSnapshot";

export type ClientPeriodStatus = "active" | "lapsed" | "future" | "invalid";

export interface PeriodClientRecord {
  startDate?: unknown;
  endDate?: unknown;
}

export interface ReportDietaryRestrictions {
  foodAllergens?: string[];
  halal?: boolean;
  kidneyFriendly?: boolean;
  lowSodium?: boolean;
  lowSugar?: boolean;
  microwaveOnly?: boolean;
  noCookingEquipment?: boolean;
  softFood?: boolean;
  vegan?: boolean;
  vegetarian?: boolean;
  heartFriendly?: boolean;
  other?: boolean;
  otherText?: string;
  dietaryPreferences?: string;
  allergies?: boolean;
  allergiesText?: string;
}

export interface ReportClientRecord extends PeriodClientRecord {
  uid: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  zipCode?: string;
  adults?: number;
  seniors?: number;
  children?: number;
  total?: number;
  referredDate?: string;
  referralEntity?: {
    id?: string;
    name?: string;
    organization?: string;
  } | null;
  deliveryDetails?: {
    dietaryRestrictions?: ReportDietaryRestrictions | null;
  } | null;
  physicalAilments?: Record<string, unknown> | null;
  physicalDisability?: Record<string, unknown> | null;
  mentalHealthConditions?: Record<string, unknown> | null;
  tags?: string[];
}

export interface ReportDeliveryRecord {
  id: string;
  clientId: string;
  clientName: string;
  deliveryDate: DateTime;
  householdSnapshot?: HouseholdSnapshot | null;
}

export interface SummaryReportResult {
  data: SummaryData;
  usedLegacySnapshotFallback: boolean;
}

export interface ClientReportData {
  Active: ReportClientRecord[];
  Lapsed: ReportClientRecord[];
}

export interface ReferralReportClient {
  id: string;
  firstName: string;
  lastName: string;
  referredDate: string;
  firstDeliveryDate: string;
}

export type ReferralAgenciesReportData = Record<string, ReferralReportClient[]>;

const isSupportedDateInput = (value: unknown): value is string | Date | DateTime | Timestamp =>
  typeof value === "string" ||
  value instanceof Date ||
  value instanceof DateTime ||
  value instanceof Timestamp;

export const SUMMARY_BAGS_PER_DELIVERY = 2;

const EMPTY_HOUSEHOLD_SNAPSHOT: HouseholdSnapshot = {
  adults: 0,
  children: 0,
  seniors: 0,
  total: 0,
};

const HEALTH_CONDITION_FIELDS = {
  heartDisease: "Heart Disease",
  cancer: "Cancer",
  diabetes: "Diabetes",
  hypertension: "Hypertension",
  kidneyDisease: "Kidney Disease",
} as const;

const DIETARY_BOOLEAN_FIELDS: Array<[keyof ReportDietaryRestrictions, string]> = [
  ["halal", "Halal"],
  ["kidneyFriendly", "Kidney Friendly"],
  ["lowSodium", "Low Sodium"],
  ["lowSugar", "Low Sugar"],
  ["microwaveOnly", "Microwave Only"],
  ["noCookingEquipment", "No Cooking Equipment"],
  ["softFood", "Soft Food"],
  ["vegan", "Vegan"],
  ["vegetarian", "Vegetarian"],
  ["heartFriendly", "Heart Friendly"],
];

export const BASE_SUMMARY_REPORT: SummaryData = {
  "Basic Output": {
    "Households Served (Duplicated)": { value: 0, isFullRow: false },
    "Households Served (Unduplicated)": { value: 0, isFullRow: false },
    "People Served (Duplicated)": { value: 0, isFullRow: false },
    "People Served (Unduplicated)": { value: 0, isFullRow: false },
    "Bags Delivered": { value: 0, isFullRow: false },
    "New Households": { value: 0, isFullRow: false },
    "New People": { value: 0, isFullRow: false },
    "Active Clients": { value: 0, isFullRow: false },
    "Lapsed Clients": { value: 0, isFullRow: false },
  },
  Demographics: {
    "New Seniors": { value: 0, isFullRow: false },
    "Total Seniors": { value: 0, isFullRow: false },
    "New Single Parents": { value: 0, isFullRow: false },
    "New Adults": { value: 0, isFullRow: false },
    "Total Adults": { value: 0, isFullRow: false },
    "New Children": { value: 0, isFullRow: false },
    "Total Children": { value: 0, isFullRow: false },
  },
  "Health Conditions": {
    "Client Health Conditions (Physical Ailments)": { value: 0, isFullRow: false },
    "Client Health Conditions (Physical Disability)": { value: 0, isFullRow: false },
    "Client Health Conditions (Mental Health Conditions)": { value: 0, isFullRow: false },
    "Heart Disease": { value: 0, isFullRow: false },
    Cancer: { value: 0, isFullRow: false },
    Diabetes: { value: 0, isFullRow: false },
    Hypertension: { value: 0, isFullRow: false },
    "Kidney Disease": { value: 0, isFullRow: false },
  },
  Referrals: {
    "New Client Referrals": { value: 0, isFullRow: false },
    "New Referral Agency Names": { value: 0, isFullRow: false },
  },
  "Dietary Restrictions": {
    "Clients with Dietary Restrictions": { value: 0, isFullRow: false },
    "Microwave Only": { value: 0, isFullRow: false },
    "No Cooking Equipment": { value: 0, isFullRow: false },
    "Soft Food": { value: 0, isFullRow: false },
    Halal: { value: 0, isFullRow: false },
    Vegan: { value: 0, isFullRow: false },
    "Low Sodium": { value: 0, isFullRow: false },
    "Low Sugar": { value: 0, isFullRow: false },
    "Heart Friendly": { value: 0, isFullRow: false },
    Vegetarian: { value: 0, isFullRow: false },
    "Kidney Friendly": { value: 0, isFullRow: false },
    Other: { value: 0, isFullRow: false },
    "No Restrictions": { value: 0, isFullRow: false },
  },
  "FAM (Food as Medicine)": {
    "Clients Receiving Medically Tailored Food": { value: 0, isFullRow: true },
  },
  Tags: {},
};

export const createEmptySummaryReport = (): SummaryData =>
  JSON.parse(JSON.stringify(BASE_SUMMARY_REPORT)) as SummaryData;

// TODO(reports-q4-q5): PM still needs to finalize the real Active/Lapsed rules.
// Keep the current date-overlap behavior centralized here until those definitions are approved.
export const getClientStatusForPeriod = (
  client: PeriodClientRecord,
  start: DateTime,
  end: DateTime
): ClientPeriodStatus => {
  if (!client.startDate) {
    return "invalid";
  }

  if (!isSupportedDateInput(client.startDate)) {
    return "invalid";
  }

  const clientStartDate = TimeUtils.fromAny(client.startDate).startOf("day");
  if (!clientStartDate.isValid) {
    return "invalid";
  }

  const clientEndDate =
    client.endDate && isSupportedDateInput(client.endDate)
      ? TimeUtils.fromAny(client.endDate).startOf("day")
      : DateTime.invalid("No end date");

  if (clientStartDate > end) {
    return "future";
  }

  if (clientEndDate.isValid && clientEndDate < start) {
    return "lapsed";
  }

  if (clientStartDate <= end && (!clientEndDate.isValid || clientEndDate >= start)) {
    return "active";
  }

  return "invalid";
};

const isDateWithinRange = (date: DateTime, start: DateTime, end: DateTime): boolean =>
  date.isValid && date >= start && date <= end;

const hasTruthyCondition = (value?: Record<string, unknown> | null): boolean => {
  if (!value) {
    return false;
  }

  return Object.entries(value).some(([key, fieldValue]) => {
    if (key === "otherText") {
      return typeof fieldValue === "string" && fieldValue.trim() !== "";
    }

    return fieldValue === true;
  });
};

const compareClients = (left: ReportClientRecord, right: ReportClientRecord): number => {
  const lastNameCompare = left.lastName.localeCompare(right.lastName, undefined, {
    sensitivity: "base",
  });
  if (lastNameCompare !== 0) {
    return lastNameCompare;
  }

  const firstNameCompare = left.firstName.localeCompare(right.firstName, undefined, {
    sensitivity: "base",
  });
  if (firstNameCompare !== 0) {
    return firstNameCompare;
  }

  return left.uid.localeCompare(right.uid, undefined, { sensitivity: "base" });
};

const getClientTagSet = (client: ReportClientRecord): Set<string> =>
  new Set(
    (Array.isArray(client.tags) ? client.tags : [])
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
  );

const hasReferralSource = (client: ReportClientRecord): boolean =>
  Boolean(
    client.referralEntity?.organization?.trim() ||
      client.referralEntity?.name?.trim() ||
      client.referralEntity?.id?.trim() ||
      client.referredDate
  );

const getHealthConditionValue = (
  conditions: Record<string, unknown> | null | undefined,
  key: keyof typeof HEALTH_CONDITION_FIELDS
): boolean => conditions?.[key] === true;

const getClientMap = (clients: ReportClientRecord[]): Map<string, ReportClientRecord> =>
  new Map(clients.map((client) => [client.uid, client]));

const groupEventsByClientId = (
  servedEvents: ReportDeliveryRecord[]
): Map<string, ReportDeliveryRecord[]> => {
  const groupedEvents = new Map<string, ReportDeliveryRecord[]>();

  servedEvents.forEach((event) => {
    const clientEvents = groupedEvents.get(event.clientId);
    if (clientEvents) {
      clientEvents.push(event);
      return;
    }

    groupedEvents.set(event.clientId, [event]);
  });

  return groupedEvents;
};

const resolveHouseholdSnapshot = (
  event: ReportDeliveryRecord | undefined,
  client: ReportClientRecord | undefined
): { snapshot: HouseholdSnapshot; usedLegacySnapshotFallback: boolean } => {
  const normalizedSnapshot = normalizeHouseholdSnapshot(event?.householdSnapshot);
  if (normalizedSnapshot) {
    return {
      snapshot: normalizedSnapshot,
      usedLegacySnapshotFallback: false,
    };
  }

  if (client) {
    return {
      snapshot: buildHouseholdSnapshot(client),
      usedLegacySnapshotFallback: true,
    };
  }

  return {
    snapshot: EMPTY_HOUSEHOLD_SNAPSHOT,
    usedLegacySnapshotFallback: true,
  };
};

const incrementDietaryRestrictions = (report: SummaryData, client: ReportClientRecord) => {
  const restrictions = client.deliveryDetails?.dietaryRestrictions;
  const dietarySection = report["Dietary Restrictions"];

  if (!restrictions) {
    dietarySection["No Restrictions"].value += 1;
    return;
  }

  let hasRestriction = false;

  DIETARY_BOOLEAN_FIELDS.forEach(([key, label]) => {
    if (restrictions[key] && dietarySection[label]) {
      dietarySection[label].value += 1;
      hasRestriction = true;
    }
  });

  const hasFoodAllergens =
    Array.isArray(restrictions.foodAllergens) && restrictions.foodAllergens.length > 0;
  const hasAllergyText =
    typeof restrictions.allergiesText === "string" && restrictions.allergiesText.trim() !== "";
  const hasOtherRestriction =
    restrictions.other === true ||
    (typeof restrictions.otherText === "string" && restrictions.otherText.trim() !== "") ||
    (typeof restrictions.dietaryPreferences === "string" &&
      restrictions.dietaryPreferences.trim() !== "");

  if (hasOtherRestriction) {
    dietarySection.Other.value += 1;
  }

  const hasAnyRestriction =
    hasRestriction ||
    hasFoodAllergens ||
    hasAllergyText ||
    restrictions.allergies === true ||
    hasOtherRestriction;

  if (hasAnyRestriction) {
    dietarySection["Clients with Dietary Restrictions"].value += 1;
    return;
  }

  dietarySection["No Restrictions"].value += 1;
};

const incrementTagCounts = (report: SummaryData, client: ReportClientRecord) => {
  const tags = getClientTagSet(client);
  const tagSection = report.Tags;

  if (tags.has("FAM")) {
    report["FAM (Food as Medicine)"]["Clients Receiving Medically Tailored Food"].value += 1;
  }

  tags.forEach((tag) => {
    if (tagSection[tag]) {
      tagSection[tag].value += 1;
      return;
    }

    tagSection[tag] = { value: 1, isFullRow: false };
  });
};

export const buildSummaryReportData = ({
  clients,
  servedEvents,
  firstDeliveriesByClientId,
  start,
  end,
}: {
  clients: ReportClientRecord[];
  servedEvents: ReportDeliveryRecord[];
  firstDeliveriesByClientId: Map<string, ReportDeliveryRecord>;
  start: DateTime;
  end: DateTime;
}): SummaryReportResult => {
  const report = createEmptySummaryReport();
  const basic = report["Basic Output"];
  const demographics = report.Demographics;
  const health = report["Health Conditions"];
  const referrals = report.Referrals;
  const referralAgencies = new Set<string>();
  const clientsById = getClientMap(clients);
  const servedEventsByClientId = groupEventsByClientId(servedEvents);

  let usedLegacySnapshotFallback = false;

  clients.forEach((client) => {
    const status = getClientStatusForPeriod(client, start, end);

    if (status === "active") {
      basic["Active Clients"].value += 1;
    } else if (status === "lapsed") {
      basic["Lapsed Clients"].value += 1;
    }
  });

  servedEvents.forEach((event) => {
    const client = clientsById.get(event.clientId);
    const { snapshot, usedLegacySnapshotFallback: usedFallback } = resolveHouseholdSnapshot(
      event,
      client
    );

    basic["Households Served (Duplicated)"].value += 1;
    basic["People Served (Duplicated)"].value += snapshot.total;

    usedLegacySnapshotFallback ||= usedFallback;
  });

  basic["Households Served (Unduplicated)"].value = servedEventsByClientId.size;
  basic["Bags Delivered"].value =
    basic["Households Served (Duplicated)"].value * SUMMARY_BAGS_PER_DELIVERY;

  servedEventsByClientId.forEach((clientEvents, clientId) => {
    const client = clientsById.get(clientId);
    const firstEventInPeriod = clientEvents[0];
    const { snapshot: firstInPeriodSnapshot, usedLegacySnapshotFallback: usedFallback } =
      resolveHouseholdSnapshot(firstEventInPeriod, client);

    basic["People Served (Unduplicated)"].value += firstInPeriodSnapshot.total;
    usedLegacySnapshotFallback ||= usedFallback;

    if (!client) {
      return;
    }

    demographics["Total Seniors"].value += firstInPeriodSnapshot.seniors;
    demographics["Total Adults"].value += firstInPeriodSnapshot.adults;
    demographics["Total Children"].value += firstInPeriodSnapshot.children;

    const firstEverDelivery = firstDeliveriesByClientId.get(clientId);
    if (firstEverDelivery && isDateWithinRange(firstEverDelivery.deliveryDate, start, end)) {
      const { snapshot: firstEverSnapshot, usedLegacySnapshotFallback: usedFirstEverFallback } =
        resolveHouseholdSnapshot(firstEverDelivery, client);

      basic["New Households"].value += 1;
      basic["New People"].value += firstEverSnapshot.total;
      demographics["New Seniors"].value += firstEverSnapshot.seniors;
      demographics["New Adults"].value += firstEverSnapshot.adults;
      demographics["New Children"].value += firstEverSnapshot.children;

      if (firstEverSnapshot.adults === 1 && firstEverSnapshot.children > 0) {
        demographics["New Single Parents"].value += 1;
      }

      if (hasReferralSource(client)) {
        referrals["New Client Referrals"].value += 1;
      }

      const organization = client.referralEntity?.organization?.trim();
      if (organization) {
        referralAgencies.add(organization);
      }

      usedLegacySnapshotFallback ||= usedFirstEverFallback;
    }

    if (hasTruthyCondition(client.physicalAilments)) {
      health["Client Health Conditions (Physical Ailments)"].value += 1;
    }

    if (hasTruthyCondition(client.physicalDisability)) {
      health["Client Health Conditions (Physical Disability)"].value += 1;
    }

    if (hasTruthyCondition(client.mentalHealthConditions)) {
      health["Client Health Conditions (Mental Health Conditions)"].value += 1;
    }

    (Object.keys(HEALTH_CONDITION_FIELDS) as Array<keyof typeof HEALTH_CONDITION_FIELDS>).forEach(
      (key) => {
        if (getHealthConditionValue(client.physicalAilments, key)) {
          health[HEALTH_CONDITION_FIELDS[key]].value += 1;
        }
      }
    );

    incrementDietaryRestrictions(report, client);
    incrementTagCounts(report, client);
  });

  referrals["New Referral Agency Names"].value = referralAgencies.size;

  return {
    data: report,
    usedLegacySnapshotFallback,
  };
};

export const buildClientReportData = (
  clients: ReportClientRecord[],
  start: DateTime,
  end: DateTime
): ClientReportData => {
  const activeClients: ReportClientRecord[] = [];
  const lapsedClients: ReportClientRecord[] = [];

  clients.forEach((client) => {
    const status = getClientStatusForPeriod(client, start, end);

    if (status === "active") {
      activeClients.push(client);
      return;
    }

    if (status === "lapsed") {
      lapsedClients.push(client);
    }
  });

  return {
    Active: [...activeClients].sort(compareClients),
    Lapsed: [...lapsedClients].sort(compareClients),
  };
};

export const buildReferralAgenciesReportData = ({
  clients,
  firstDeliveriesByClientId,
  start,
  end,
}: {
  clients: ReportClientRecord[];
  firstDeliveriesByClientId: Map<string, ReportDeliveryRecord>;
  start: DateTime;
  end: DateTime;
}): ReferralAgenciesReportData => {
  const groupedByAgency = new Map<string, ReferralReportClient[]>();

  [...clients].sort(compareClients).forEach((client) => {
    const organization = client.referralEntity?.organization?.trim();
    const firstDelivery = firstDeliveriesByClientId.get(client.uid);

    if (
      !organization ||
      !firstDelivery ||
      !isDateWithinRange(firstDelivery.deliveryDate, start, end)
    ) {
      return;
    }

    const agencyClients = groupedByAgency.get(organization) ?? [];
    agencyClients.push({
      id: client.uid,
      firstName: client.firstName,
      lastName: client.lastName,
      referredDate: client.referredDate ?? "",
      firstDeliveryDate: firstDelivery.deliveryDate.toISODate() ?? "",
    });
    groupedByAgency.set(organization, agencyClients);
  });

  return Array.from(groupedByAgency.entries())
    .sort(([leftAgency], [rightAgency]) =>
      leftAgency.localeCompare(rightAgency, undefined, { sensitivity: "base" })
    )
    .reduce<ReferralAgenciesReportData>((report, [agency, agencyClients]) => {
      report[agency] = agencyClients;
      return report;
    }, {});
};
