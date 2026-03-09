import { DateTime } from "luxon";
import { Timestamp } from "firebase/firestore";
import { SummaryData } from "../../types/reports-types";
import TimeUtils from "../../utils/timeUtils";

export type ClientPeriodStatus = "active" | "lapsed" | "future" | "invalid";

export interface PeriodClientRecord {
  startDate?: unknown;
  endDate?: unknown;
}

export interface SummaryClientRecord extends PeriodClientRecord {
  adults?: number;
  seniors?: number;
  children?: number;
  deliveries?: string[];
  referredDate?: string;
  referralEntity?: {
    organization?: string;
  } | null;
  deliveryDetails?: {
    dietaryRestrictions?: {
      foodAllergens?: string[];
      halal?: boolean;
      kidneyFriendly?: boolean;
      lowSodium?: boolean;
      lowSugar?: boolean;
      microwaveOnly?: boolean;
      noCookingEquipment?: boolean;
      other?: boolean;
      otherText?: string;
      dietaryPreferences?: string;
      softFood?: boolean;
      vegan?: boolean;
      vegetarian?: boolean;
      heartFriendly?: boolean;
    };
  };
  physicalAilments?: Record<string, unknown> | null;
  physicalDisability?: Record<string, unknown> | null;
  mentalHealthConditions?: Record<string, unknown> | null;
  tags?: string[];
}

const isSupportedDateInput = (value: unknown): value is string | Date | DateTime | Timestamp =>
  typeof value === "string" ||
  value instanceof Date ||
  value instanceof DateTime ||
  value instanceof Timestamp;

export const SUMMARY_BAGS_PER_DELIVERY = 2;

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
  },
  Referrals: {
    "New Client Referrals": { value: 0, isFullRow: false },
    "New Referral Agency Names": { value: 0, isFullRow: false },
  },
  "Dietary Restrictions": {
    "Lactose Intolerant": { value: 0, isFullRow: false },
    "Microwave Only": { value: 0, isFullRow: false },
    "Diabetes Friendly": { value: 0, isFullRow: false },
    "No Cans": { value: 0, isFullRow: false },
    "Food Allergen": { value: 0, isFullRow: false },
    "No Cooking Equipment": { value: 0, isFullRow: false },
    "Gluten Free": { value: 0, isFullRow: false },
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

const countHouseholdSize = (client: SummaryClientRecord): number =>
  (Number(client.adults) || 0) + (Number(client.seniors) || 0) + (Number(client.children) || 0);

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

const isDateWithinRange = (
  dateString: string | undefined,
  start: DateTime,
  end: DateTime
): boolean => {
  if (!dateString) {
    return false;
  }

  const date = TimeUtils.fromISO(dateString);
  return date.isValid && date >= start && date <= end;
};

const getDeliveriesInRange = (
  deliveries: string[] | undefined,
  start: DateTime,
  end: DateTime
): string[] =>
  (deliveries ?? []).filter((deliveryString) => isDateWithinRange(deliveryString, start, end));

const isNewClientInPeriod = (
  client: SummaryClientRecord,
  deliveriesInRange: string[],
  start: DateTime,
  end: DateTime
): boolean => {
  if (deliveriesInRange.length > 0) {
    const firstDelivery = (client.deliveries ?? [])
      .map((deliveryString) => TimeUtils.fromISO(deliveryString))
      .filter((deliveryDate) => deliveryDate.isValid)
      .sort((left, right) => left.toMillis() - right.toMillis())[0];

    return !!firstDelivery && firstDelivery >= start && firstDelivery <= end;
  }

  if (!client.startDate) {
    return false;
  }

  if (!isSupportedDateInput(client.startDate)) {
    return false;
  }

  const clientStart = TimeUtils.fromAny(client.startDate).startOf("day");
  return clientStart.isValid && clientStart >= start && clientStart <= end;
};

const incrementDietaryRestrictions = (report: SummaryData, client: SummaryClientRecord) => {
  const restrictions = client.deliveryDetails?.dietaryRestrictions;
  const dietarySection = report["Dietary Restrictions"];

  if (!restrictions) {
    dietarySection["No Restrictions"].value += 1;
    return;
  }

  let added = false;
  const booleanMappings: Array<[keyof typeof restrictions, string]> = [
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

  booleanMappings.forEach(([key, label]) => {
    if (restrictions[key] && dietarySection[label]) {
      dietarySection[label].value += 1;
      added = true;
    }
  });

  if ((restrictions.foodAllergens ?? []).length > 0) {
    dietarySection["Food Allergen"].value += restrictions.foodAllergens?.length ?? 0;
    added = true;
  }

  const hasOtherRestriction =
    restrictions.other === true ||
    (typeof restrictions.otherText === "string" && restrictions.otherText.trim() !== "") ||
    (typeof restrictions.dietaryPreferences === "string" &&
      restrictions.dietaryPreferences.trim() !== "");

  if (hasOtherRestriction) {
    dietarySection.Other.value += 1;
    added = true;
  }

  if (!added) {
    dietarySection["No Restrictions"].value += 1;
  }
};

const incrementTagCounts = (report: SummaryData, client: SummaryClientRecord) => {
  const tags = Array.isArray(client.tags) ? client.tags : [];
  const tagSection = report.Tags;

  tags.forEach((tag) => {
    if (tag === "FAM") {
      report["FAM (Food as Medicine)"]["Clients Receiving Medically Tailored Food"].value += 1;
    }

    if (tagSection[tag]) {
      tagSection[tag].value += 1;
      return;
    }

    tagSection[tag] = { value: 1, isFullRow: false };
  });
};

export const buildSummaryReportData = (
  clients: SummaryClientRecord[],
  start: DateTime,
  end: DateTime
): SummaryData => {
  const report = createEmptySummaryReport();
  const basic = report["Basic Output"];
  const demographics = report.Demographics;
  const health = report["Health Conditions"];
  const referrals = report.Referrals;
  const referralAgencies = new Set<string>();

  clients.forEach((client) => {
    const status = getClientStatusForPeriod(client, start, end);

    if (status === "active") {
      basic["Active Clients"].value += 1;
    } else if (status === "lapsed") {
      basic["Lapsed Clients"].value += 1;
    }

    if (isDateWithinRange(client.referredDate, start, end)) {
      referrals["New Client Referrals"].value += 1;
      const organization = client.referralEntity?.organization?.trim();
      if (organization) {
        referralAgencies.add(organization);
      }
    }

    const deliveriesInRange = getDeliveriesInRange(client.deliveries, start, end);
    if (deliveriesInRange.length === 0) {
      return;
    }

    const adults = Number(client.adults) || 0;
    const seniors = Number(client.seniors) || 0;
    const children = Number(client.children) || 0;
    const householdSize = countHouseholdSize(client);
    const duplicatedHouseholds = deliveriesInRange.length;

    basic["Households Served (Duplicated)"].value += duplicatedHouseholds;
    basic["Households Served (Unduplicated)"].value += 1;
    basic["People Served (Duplicated)"].value += householdSize * duplicatedHouseholds;
    basic["People Served (Unduplicated)"].value += householdSize;
    basic["Bags Delivered"].value += duplicatedHouseholds;

    demographics["Total Seniors"].value += seniors;
    demographics["Total Adults"].value += adults;
    demographics["Total Children"].value += children;

    if (isNewClientInPeriod(client, deliveriesInRange, start, end)) {
      basic["New Households"].value += 1;
      basic["New People"].value += householdSize;
      demographics["New Seniors"].value += seniors;
      demographics["New Adults"].value += adults;
      demographics["New Children"].value += children;

      if (adults === 1 && children > 0) {
        demographics["New Single Parents"].value += 1;
      }
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

    incrementDietaryRestrictions(report, client);
    incrementTagCounts(report, client);
  });

  referrals["New Referral Agency Names"].value = referralAgencies.size;
  basic["Bags Delivered"].value *= SUMMARY_BAGS_PER_DELIVERY;

  return report;
};
