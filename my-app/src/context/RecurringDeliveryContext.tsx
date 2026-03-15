import React, { createContext, useContext, useRef, useCallback, useMemo } from "react";
import DeliveryService from "../services/delivery-service";

interface RecurringDeliveryDateRange {
  earliest: Date | null;
  latest: Date | null;
}

interface RecurringDeliveryContextType {
  getDateRange: (seriesKey: string) => Promise<RecurringDeliveryDateRange>;
  preloadDateRanges: (seriesKeys: string[]) => Promise<void>;
  clearCache: () => void;
}

const RecurringDeliveryContext = createContext<RecurringDeliveryContextType | undefined>(undefined);

export const RecurringDeliveryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const promiseCacheRef = useRef(new Map<string, Promise<RecurringDeliveryDateRange>>());
  const deliveryService = useMemo(() => DeliveryService.getInstance(), []);

  const getDateRange = useCallback(
    async (seriesKey: string): Promise<RecurringDeliveryDateRange> => {
      if (!seriesKey) {
        return { earliest: null, latest: null };
      }

      if (!promiseCacheRef.current.has(seriesKey)) {
        const promise = deliveryService.getDeliverySeriesDateRange(seriesKey);
        promiseCacheRef.current.set(seriesKey, promise);
        promise.finally(() => promiseCacheRef.current.delete(seriesKey));
      }

      return promiseCacheRef.current.get(seriesKey)!;
    },
    [deliveryService]
  );

  const preloadDateRanges = useCallback(
    async (seriesKeys: string[]): Promise<void> => {
      const uniqueSeriesKeys = Array.from(new Set(seriesKeys.filter(Boolean))).filter(
        (seriesKey) => !promiseCacheRef.current.has(seriesKey)
      );

      if (uniqueSeriesKeys.length === 0) return;

      const batchPromise = deliveryService.getBatchDeliverySeriesDateRanges(uniqueSeriesKeys);

      uniqueSeriesKeys.forEach((seriesKey) => {
        promiseCacheRef.current.set(
          seriesKey,
          batchPromise.then(
            (ranges) => ranges.get(seriesKey) || { earliest: null, latest: null }
          )
        );
      });

      try {
        await batchPromise;
      } finally {
        uniqueSeriesKeys.forEach((seriesKey) => {
          promiseCacheRef.current.delete(seriesKey);
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
