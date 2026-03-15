import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
  Timestamp,
  where,
} from "firebase/firestore";
import { DateTime } from "luxon";
import { db } from "../../auth/firebaseConfig";
import dataSources from "../../config/dataSources";
import { HouseholdSnapshot } from "../../types/delivery-types";
import { deliveryDate } from "../../utils/deliveryDate";
import { normalizeHouseholdSnapshot } from "../../utils/householdSnapshot";
import { ReportClientRecord, ReportDeliveryRecord } from "./reportUtils";

const CLIENT_PAGE_SIZE = 200;
const FIRESTORE_IN_QUERY_LIMIT = 10;

const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const asNumber = (value: unknown): number => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const asNullableObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const normalizeDeliveryDate = (value: unknown): DateTime | null =>
  deliveryDate.tryToDateTime(value as string | Date | DateTime | Timestamp | null | undefined);

const mapReportClient = (docSnapshot: QueryDocumentSnapshot): ReportClientRecord => {
  const raw = docSnapshot.data() as Record<string, unknown>;
  const deliveryDetails = asRecord(raw.deliveryDetails);
  const dietaryRestrictions = asNullableObject(deliveryDetails.dietaryRestrictions);
  const referralEntity = asNullableObject(raw.referralEntity);

  return {
    uid: docSnapshot.id,
    firstName: asString(raw.firstName),
    lastName: asString(raw.lastName),
    phone: asString(raw.phone),
    address: asString(raw.address),
    zipCode: asString(raw.zipCode),
    adults: asNumber(raw.adults),
    children: asNumber(raw.children),
    seniors: asNumber(raw.seniors),
    total: asNumber(raw.total),
    referredDate: asString(raw.referredDate) || undefined,
    startDate: raw.startDate,
    endDate: raw.endDate,
    referralEntity: referralEntity
      ? {
          id:
            typeof referralEntity.id === "string" && referralEntity.id.trim()
              ? referralEntity.id
              : undefined,
          name:
            typeof referralEntity.name === "string" && referralEntity.name.trim()
              ? referralEntity.name
              : undefined,
          organization:
            typeof referralEntity.organization === "string" && referralEntity.organization.trim()
              ? referralEntity.organization
              : undefined,
        }
      : null,
    deliveryDetails: dietaryRestrictions
      ? {
          dietaryRestrictions: {
            foodAllergens: asStringArray(dietaryRestrictions.foodAllergens),
            halal: dietaryRestrictions.halal === true,
            kidneyFriendly: dietaryRestrictions.kidneyFriendly === true,
            lowSodium: dietaryRestrictions.lowSodium === true,
            lowSugar: dietaryRestrictions.lowSugar === true,
            microwaveOnly: dietaryRestrictions.microwaveOnly === true,
            noCookingEquipment: dietaryRestrictions.noCookingEquipment === true,
            softFood: dietaryRestrictions.softFood === true,
            vegan: dietaryRestrictions.vegan === true,
            vegetarian: dietaryRestrictions.vegetarian === true,
            heartFriendly: dietaryRestrictions.heartFriendly === true,
            other: dietaryRestrictions.other === true,
            otherText: asString(dietaryRestrictions.otherText) || undefined,
            dietaryPreferences: asString(dietaryRestrictions.dietaryPreferences) || undefined,
            allergies: dietaryRestrictions.allergies === true,
            allergiesText: asString(dietaryRestrictions.allergiesText) || undefined,
          },
        }
      : undefined,
    physicalAilments: asNullableObject(raw.physicalAilments),
    physicalDisability: asNullableObject(raw.physicalDisability),
    mentalHealthConditions: asNullableObject(raw.mentalHealthConditions),
    tags: asStringArray(raw.tags),
  };
};

const mapReportDelivery = (docSnapshot: QueryDocumentSnapshot): ReportDeliveryRecord | null => {
  const raw = docSnapshot.data() as Record<string, unknown>;
  const normalizedDate = normalizeDeliveryDate(raw.deliveryDate);

  if (!normalizedDate || !normalizedDate.isValid) {
    return null;
  }

  return {
    id: docSnapshot.id,
    clientId: asString(raw.clientId),
    clientName: asString(raw.clientName),
    deliveryDate: normalizedDate,
    householdSnapshot: normalizeHouseholdSnapshot(
      raw.householdSnapshot as Partial<HouseholdSnapshot> | null | undefined
    ),
  };
};

export const loadAllReportClients = async (): Promise<ReportClientRecord[]> => {
  const clients: ReportClientRecord[] = [];
  let lastDoc: QueryDocumentSnapshot | undefined;
  let hasMoreClients = true;

  while (hasMoreClients) {
    const baseQuery = query(
      collection(db, dataSources.firebase.clientsCollection),
      orderBy(documentId()),
      limit(CLIENT_PAGE_SIZE)
    );
    const nextQuery = lastDoc ? query(baseQuery, startAfter(lastDoc)) : baseQuery;
    const snapshot = await getDocs(nextQuery);

    if (snapshot.empty) {
      break;
    }

    snapshot.docs.forEach((docSnapshot) => {
      clients.push(mapReportClient(docSnapshot));
    });

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    hasMoreClients = snapshot.size === CLIENT_PAGE_SIZE;
  }

  return clients;
};

export const loadReportClientsByIds = async (
  clientIds: string[]
): Promise<ReportClientRecord[]> => {
  const uniqueClientIds = Array.from(new Set(clientIds.filter(Boolean)));

  if (uniqueClientIds.length === 0) {
    return [];
  }

  const clientChunks = chunkArray(uniqueClientIds, FIRESTORE_IN_QUERY_LIMIT);
  const snapshots = await Promise.all(
    clientChunks.map((chunk) =>
      getDocs(
        query(
          collection(db, dataSources.firebase.clientsCollection),
          where(documentId(), "in", chunk)
        )
      )
    )
  );

  return snapshots.flatMap((snapshot) =>
    snapshot.docs.map((docSnapshot) => mapReportClient(docSnapshot))
  );
};

export const loadInclusiveReportEvents = async (
  start: DateTime,
  end: DateTime
): Promise<ReportDeliveryRecord[]> => {
  const snapshot = await getDocs(
    query(
      collection(db, dataSources.firebase.calendarCollection),
      where("deliveryDate", ">=", Timestamp.fromDate(start.toJSDate())),
      where("deliveryDate", "<=", Timestamp.fromDate(end.toJSDate())),
      orderBy("deliveryDate", "asc")
    )
  );

  return snapshot.docs
    .map((docSnapshot) => mapReportDelivery(docSnapshot))
    .filter((event): event is ReportDeliveryRecord => !!event && Boolean(event.clientId));
};

export const loadFirstDeliveriesByClientIds = async (
  clientIds: string[]
): Promise<Map<string, ReportDeliveryRecord>> => {
  const firstDeliveriesByClientId = new Map<string, ReportDeliveryRecord>();
  const uniqueClientIds = Array.from(new Set(clientIds.filter(Boolean)));

  if (uniqueClientIds.length === 0) {
    return firstDeliveriesByClientId;
  }

  const clientChunks = chunkArray(uniqueClientIds, FIRESTORE_IN_QUERY_LIMIT);
  const snapshots = await Promise.all(
    clientChunks.map((chunk) =>
      getDocs(
        query(
          collection(db, dataSources.firebase.calendarCollection),
          where("clientId", "in", chunk),
          orderBy("clientId", "asc"),
          orderBy("deliveryDate", "asc")
        )
      )
    )
  );

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((docSnapshot) => {
      const event = mapReportDelivery(docSnapshot);

      if (!event || !event.clientId || firstDeliveriesByClientId.has(event.clientId)) {
        return;
      }

      firstDeliveriesByClientId.set(event.clientId, event);
    });
  });

  return firstDeliveriesByClientId;
};
