export interface SavedSearchItem {
  name: string;
  query: string;
  savedAt: string;
}

const MAX_SAVED_SEARCHES = 5;

const getSafeUserKey = (userId?: string | null): string => {
  const normalized = (userId || "").trim();
  return normalized || "guest";
};

export const getSavedSearchesStorageKey = (userId?: string | null): string =>
  `routes:savedSearches:${getSafeUserKey(userId)}`;

const buildDefaultSearchName = (query: string): string => {
  const trimmed = query.trim();
  if (!trimmed) {
    return "Saved search";
  }

  if (trimmed.length <= 40) {
    return trimmed;
  }

  return `${trimmed.slice(0, 37)}...`;
};

export const removeDuplicateAndLimitToFive = (searches: SavedSearchItem[]): SavedSearchItem[] => {
  const seen = new Set<string>();
  const deduped: SavedSearchItem[] = [];

  for (const search of searches) {
    const trimmedQuery = search.query.trim();
    if (!trimmedQuery) {
      continue;
    }

    const dedupeKey = trimmedQuery.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    deduped.push({
      name: (search.name || "").trim() || buildDefaultSearchName(trimmedQuery),
      query: trimmedQuery,
      savedAt: search.savedAt,
    });

    if (deduped.length >= MAX_SAVED_SEARCHES) {
      break;
    }
  }

  return deduped;
};

export const getSavedSearches = (userId?: string | null): SavedSearchItem[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const storageKey = getSavedSearchesStorageKey(userId);
  const raw = window.localStorage.getItem(storageKey);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<Partial<SavedSearchItem>>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return removeDuplicateAndLimitToFive(
      parsed.filter(
        (item) =>
          item && typeof item.query === "string" && typeof item.savedAt === "string"
      ) as SavedSearchItem[]
    );
  } catch {
    return [];
  }
};

export const deleteSearch = (
  userId: string | null | undefined,
  query: string
): SavedSearchItem[] => {
  if (typeof window === "undefined") {
    return getSavedSearches(userId);
  }

  const trimmedQuery = query.trim().toLowerCase();
  const updated = getSavedSearches(userId).filter(
    (s) => s.query.trim().toLowerCase() !== trimmedQuery
  );

  const storageKey = getSavedSearchesStorageKey(userId);
  window.localStorage.setItem(storageKey, JSON.stringify(updated));
  return updated;
};

export const findByName = (
  searches: SavedSearchItem[],
  name: string
): SavedSearchItem | undefined => {
  const normalized = name.trim().toLowerCase();
  return searches.find((s) => s.name.trim().toLowerCase() === normalized);
};

export const replaceByName = (
  userId: string | null | undefined,
  name: string,
  newQuery: string
): SavedSearchItem[] => {
  if (typeof window === "undefined") {
    return getSavedSearches(userId);
  }

  const existing = getSavedSearches(userId);
  const normalized = name.trim().toLowerCase();
  const updated = existing.map((s) =>
    s.name.trim().toLowerCase() === normalized
      ? { ...s, query: newQuery.trim(), savedAt: new Date().toISOString() }
      : s
  );

  const storageKey = getSavedSearchesStorageKey(userId);
  window.localStorage.setItem(storageKey, JSON.stringify(updated));
  return updated;
};

export const saveSearch = (
  userId: string | null | undefined,
  query: string,
  name?: string
): SavedSearchItem[] => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery || typeof window === "undefined") {
    return getSavedSearches(userId);
  }

  const trimmedName = (name || "").trim();

  const storageKey = getSavedSearchesStorageKey(userId);
  const next: SavedSearchItem[] = removeDuplicateAndLimitToFive([
    {
      name: trimmedName || buildDefaultSearchName(trimmedQuery),
      query: trimmedQuery,
      savedAt: new Date().toISOString(),
    },
    ...getSavedSearches(userId),
  ]);

  window.localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
};
