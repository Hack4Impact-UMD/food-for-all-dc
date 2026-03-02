import { deliveryDate } from "./deliveryDate";

const STORAGE_KEY = "delivery-route-clears:v1";

type RouteClearNoticeMap = Record<string, true>;

const readNotices = (): RouteClearNoticeMap => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as RouteClearNoticeMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("Failed to read delivery route clear notices:", error);
    return {};
  }
};

const writeNotices = (notices: RouteClearNoticeMap) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(notices));
  } catch (error) {
    console.error("Failed to write delivery route clear notices:", error);
  }
};

const normalizeDateKeys = (dateKeys: string[]): string[] =>
  Array.from(
    new Set(
      dateKeys
        .map((dateKey) => deliveryDate.tryToISODateString(dateKey))
        .filter((dateKey): dateKey is string => !!dateKey)
    )
  );

export const recordClearedRouteDates = (dateKeys: string[]) => {
  const normalizedDateKeys = normalizeDateKeys(dateKeys);
  if (!normalizedDateKeys.length) {
    return;
  }

  const notices = readNotices();
  normalizedDateKeys.forEach((dateKey) => {
    notices[dateKey] = true;
  });
  writeNotices(notices);
};

export const hasClearedRouteNotice = (dateKey: string): boolean => {
  const normalizedDateKey = deliveryDate.tryToISODateString(dateKey);
  if (!normalizedDateKey) {
    return false;
  }

  const notices = readNotices();
  return Boolean(notices[normalizedDateKey]);
};

export const dismissClearedRouteNotice = (dateKey: string) => {
  clearClearedRouteNotice(dateKey);
};

export const clearClearedRouteNotice = (dateKey: string) => {
  const normalizedDateKey = deliveryDate.tryToISODateString(dateKey);
  if (!normalizedDateKey) {
    return;
  }

  const notices = readNotices();
  if (!notices[normalizedDateKey]) {
    return;
  }

  delete notices[normalizedDateKey];
  writeNotices(notices);
};

export const formatDeliveryDateLabel = (dateKey: string): string => {
  const jsDate = deliveryDate.toJSDate(dateKey);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(jsDate);
};
