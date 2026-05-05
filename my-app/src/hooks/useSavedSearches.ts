import { useCallback, useEffect, useState } from "react";
import {
  getSavedSearches,
  saveSearch,
  replaceByName,
  deleteSearch,
  SavedSearchItem,
} from "../pages/Delivery/utils/savedSearches";

export const useSavedSearches = (userId?: string | null) => {
  const [savedSearches, setSavedSearches] = useState<SavedSearchItem[]>(() => getSavedSearches(userId));

  useEffect(() => {
    setSavedSearches(getSavedSearches(userId));
  }, [userId]);

  const saveCurrentSearch = useCallback(
    (query: string, name?: string) => {
      const next = saveSearch(userId, query, name);
      setSavedSearches(next);
      return next;
    },
    [userId]
  );

  const applySavedSearch = useCallback(
    (query: string, onApply: (value: string) => void, name?: string) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        return;
      }

      const next = saveSearch(userId, trimmedQuery, name);
      setSavedSearches(next);
      onApply(trimmedQuery);
    },
    [userId]
  );

  const overwriteSavedSearch = useCallback(
    (name: string, newQuery: string) => {
      const next = replaceByName(userId, name, newQuery);
      setSavedSearches(next);
      return next;
    },
    [userId]
  );

  const deleteSavedSearch = useCallback(
    (query: string) => {
      const next = deleteSearch(userId, query);
      setSavedSearches(next);
      return next;
    },
    [userId]
  );

  return {
    savedSearches,
    saveCurrentSearch,
    applySavedSearch,
    overwriteSavedSearch,
    deleteSavedSearch,
  };
};
