import React, { createContext, useContext, useRef, useCallback, useMemo } from 'react';
import DeliveryService from '../services/delivery-service';

interface RecurringDeliveryDateRange {
  earliest: Date | null;
  latest: Date | null;
}

interface RecurringDeliveryContextType {
  getDateRange: (clientId: string, recurrenceType: string) => Promise<RecurringDeliveryDateRange>;
  preloadDateRanges: (requests: Array<{ clientId: string; recurrenceType: string }>) => Promise<void>;
  clearCache: () => void;
}

const RecurringDeliveryContext = createContext<RecurringDeliveryContextType | undefined>(undefined);

export const RecurringDeliveryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const promiseCacheRef = useRef(new Map<string, Promise<RecurringDeliveryDateRange>>());
  const deliveryService = useMemo(() => DeliveryService.getInstance(), []);

  const getDateRange = useCallback(async (
    clientId: string,
    recurrenceType: string
  ): Promise<RecurringDeliveryDateRange> => {
    const requestKey = `${clientId}-${recurrenceType}`;

    if (!promiseCacheRef.current.has(requestKey)) {
      const promise = deliveryService.getRecurringDeliveryDateRange(clientId, recurrenceType);
      promiseCacheRef.current.set(requestKey, promise);
      promise.finally(() => promiseCacheRef.current.delete(requestKey));
    }

    return promiseCacheRef.current.get(requestKey)!;
  }, [deliveryService]);

  const preloadDateRanges = useCallback(async (
    requests: Array<{ clientId: string; recurrenceType: string }>
  ): Promise<void> => {
    const uniqueRequests = requests.filter(req => {
      const requestKey = `${req.clientId}-${req.recurrenceType}`;
      return !promiseCacheRef.current.has(requestKey);
    });

    if (uniqueRequests.length === 0) return;

    const promise = deliveryService.getBatchRecurringDeliveryDateRanges(uniqueRequests);

    uniqueRequests.forEach(req => {
      const requestKey = `${req.clientId}-${req.recurrenceType}`;
      promiseCacheRef.current.set(requestKey, promise.then(() => ({ earliest: null, latest: null })));
    });

    try {
      await promise;
    } finally {
      uniqueRequests.forEach(req => {
        const requestKey = `${req.clientId}-${req.recurrenceType}`;
        promiseCacheRef.current.delete(requestKey);
      });
    }
  }, [deliveryService]);

  const clearCache = useCallback(() => {
    deliveryService.clearDateRangeCache();
  }, [deliveryService]);

  const contextValue = useMemo(() => ({
    getDateRange,
    preloadDateRanges,
    clearCache
  }), [getDateRange, preloadDateRanges, clearCache]);

  return (
    <RecurringDeliveryContext.Provider value={contextValue}>
      {children}
    </RecurringDeliveryContext.Provider>
  );
};

export const useRecurringDelivery = (): RecurringDeliveryContextType => {
  const context = useContext(RecurringDeliveryContext);
  if (!context) {
    throw new Error('useRecurringDelivery must be used within a RecurringDeliveryProvider');
  }
  return context;
};