import React, { createContext, useContext, useRef, useCallback, useMemo } from "react";
import DeliveryService from "../services/delivery-service";

interface RecurringDeliveryDateRange {
  earliest: Date | null;
  latest: Date | null;
}

interface RecurringDeliveryContextType {
  getDateRange: (recurrenceId: string) => Promise<RecurringDeliveryDateRange>;
  preloadDateRanges: (recurrenceIds: string[]) => Promise<void>;
  clearCache: () => void;
}

const RecurringDeliveryContext = createContext<RecurringDeliveryContextType | undefined>(undefined);

export const RecurringDeliveryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const promiseCacheRef = useRef(new Map<string, Promise<RecurringDeliveryDateRange>>());
  const deliveryService = useMemo(() => DeliveryService.getInstance(), []);

  const getDateRange = useCallback(
    async (recurrenceId: string): Promise<RecurringDeliveryDateRange> => {
      const requestKey = recurrenceId.trim();
      if (!requestKey) {
        return { earliest: null, latest: null };
      }

      if (!promiseCacheRef.current.has(requestKey)) {
        const promise = deliveryService.getSeriesDateRange(requestKey);
        promiseCacheRef.current.set(requestKey, promise);
        promise.finally(() => promiseCacheRef.current.delete(requestKey));
      }

      return promiseCacheRef.current.get(requestKey)!;
    },
    [deliveryService]
  );

  const preloadDateRanges = useCallback(
    async (recurrenceIds: string[]): Promise<void> => {
      const uniqueRecurrenceIds = Array.from(
        new Set(recurrenceIds.map((recurrenceId) => recurrenceId.trim()).filter(Boolean))
      ).filter((recurrenceId) => !promiseCacheRef.current.has(recurrenceId));

      if (uniqueRecurrenceIds.length === 0) return;

      const promise = deliveryService.getBatchSeriesDateRanges(uniqueRecurrenceIds);

      uniqueRecurrenceIds.forEach((requestKey) => {
        promiseCacheRef.current.set(
          requestKey,
          promise.then((results) => results.get(requestKey) || { earliest: null, latest: null })
        );
      });

      try {
        await promise;
      } finally {
        uniqueRecurrenceIds.forEach((requestKey) => {
          promiseCacheRef.current.delete(requestKey);
        });
      }
    },
    [deliveryService]
  );

  const clearCache = useCallback(() => {
    promiseCacheRef.current.clear();
    deliveryService.clearDateRangeCache();
  }, [deliveryService]);

  const contextValue = useMemo(
    () => ({
      getDateRange,
      preloadDateRanges,
      clearCache,
    }),
    [getDateRange, preloadDateRanges, clearCache]
  );

  return (
    <RecurringDeliveryContext.Provider value={contextValue}>
      {children}
    </RecurringDeliveryContext.Provider>
  );
};

export const useRecurringDelivery = (): RecurringDeliveryContextType => {
  const context = useContext(RecurringDeliveryContext);
  if (!context) {
    throw new Error("useRecurringDelivery must be used within a RecurringDeliveryProvider");
  }
  return context;
};
