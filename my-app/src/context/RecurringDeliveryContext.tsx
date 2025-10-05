import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
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
  const [pendingRequests] = useState(new Set<string>());
  const deliveryService = useMemo(() => DeliveryService.getInstance(), []);

  const getDateRange = useCallback(async (
    clientId: string, 
    recurrenceType: string
  ): Promise<RecurringDeliveryDateRange> => {
    const requestKey = `${clientId}-${recurrenceType}`;
    
    // Avoid duplicate requests
    if (pendingRequests.has(requestKey)) {
      // Wait a bit and try again (simple debouncing)
      await new Promise(resolve => setTimeout(resolve, 50));
      if (pendingRequests.has(requestKey)) {
        return { earliest: null, latest: null };
      }
    }

    pendingRequests.add(requestKey);
    
    try {
      const result = await deliveryService.getRecurringDeliveryDateRange(clientId, recurrenceType);
      return result;
    } finally {
      pendingRequests.delete(requestKey);
    }
  }, [deliveryService, pendingRequests]);

  const preloadDateRanges = useCallback(async (
    requests: Array<{ clientId: string; recurrenceType: string }>
  ): Promise<void> => {
    // Filter out requests that are already pending
    const uniqueRequests = requests.filter(req => {
      const requestKey = `${req.clientId}-${req.recurrenceType}`;
      return !pendingRequests.has(requestKey);
    });

    if (uniqueRequests.length === 0) return;

    // Mark requests as pending
    uniqueRequests.forEach(req => {
      const requestKey = `${req.clientId}-${req.recurrenceType}`;
      pendingRequests.add(requestKey);
    });

    try {
      await deliveryService.getBatchRecurringDeliveryDateRanges(uniqueRequests);
    } finally {
      // Clear pending status
      uniqueRequests.forEach(req => {
        const requestKey = `${req.clientId}-${req.recurrenceType}`;
        pendingRequests.delete(requestKey);
      });
    }
  }, [deliveryService, pendingRequests]);

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