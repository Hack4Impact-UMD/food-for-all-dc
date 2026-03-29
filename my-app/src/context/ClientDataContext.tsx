import React, {
  startTransition,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { DateTime } from "luxon";
import { useAuth } from "../auth/AuthProvider";
import { clientService } from "../services/client-service";
import { RowData } from "../components/Spreadsheet/export";
import type { ClientDeliverySummary } from "../utils/lastDeliveryDate";

interface ClientDataContextType {
  clients: RowData[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const ClientDataContext = createContext<ClientDataContextType | undefined>(undefined);

const getTodayET = (): string => DateTime.now().setZone("America/New_York").toISODate() ?? "";
const DELIVERY_SUMMARY_BATCH_SIZE = 100;
const DELIVERY_SUMMARY_BATCH_DELAY_MS = 40;
const DELIVERY_SUMMARY_FLUSH_INTERVAL_MS = 200;

const compareRowsByName = (left: RowData, right: RowData): number => {
  const lastCompare = (left.lastName || "").localeCompare(right.lastName || "", undefined, {
    sensitivity: "base",
  });

  if (lastCompare !== 0) {
    return lastCompare;
  }

  return (left.firstName || "").localeCompare(right.firstName || "", undefined, {
    sensitivity: "base",
  });
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const mergeDeliverySummaries = (
  rows: RowData[],
  readyIds: Set<string>,
  summaries: Map<string, ClientDeliverySummary>
): RowData[] =>
  rows.map((row) => {
    if (!readyIds.has(row.uid)) {
      return row;
    }

    const summary = summaries.get(row.uid);
    return {
      ...row,
      lastDeliveryDate: summary?.lastDeliveryDate ?? "",
      missedStrikeCount: summary?.missedStrikeCount ?? 0,
      deliverySummaryReady: true,
    };
  });

export const ClientDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [clients, setClients] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, loading: authLoading } = useAuth();
  const inFlightRefreshRef = useRef<Promise<void> | null>(null);
  const hydrationRunIdRef = useRef(0);
  const hydratedClientIdsRef = useRef<Set<string>>(new Set());
  const pendingHydrationSummariesRef = useRef<Map<string, ClientDeliverySummary>>(new Map());
  const pendingHydrationIdsRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<number | null>(null);

  const updateRefreshMetadata = useCallback(() => {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    window.localStorage.setItem("clientsLastRefreshDate", getTodayET());
    if (window.localStorage.getItem("forceClientsRefresh") === "true") {
      window.localStorage.removeItem("forceClientsRefresh");
    }
  }, []);

  const clearPendingHydrationFlush = useCallback(() => {
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const commitDeliverySummaries = useCallback(
    (runId: number, readyIds: Set<string>, summaries: Map<string, ClientDeliverySummary>) => {
      startTransition(() => {
        setClients((previousClients) => {
          if (hydrationRunIdRef.current !== runId) {
            return previousClients;
          }

          return mergeDeliverySummaries(previousClients, readyIds, summaries);
        });
      });
    },
    []
  );

  const flushPendingHydration = useCallback(
    (runId: number) => {
      if (hydrationRunIdRef.current !== runId || pendingHydrationIdsRef.current.size === 0) {
        pendingHydrationIdsRef.current.clear();
        pendingHydrationSummariesRef.current.clear();
        clearPendingHydrationFlush();
        return;
      }

      const readyIds = new Set(pendingHydrationIdsRef.current);
      const summaries = new Map(pendingHydrationSummariesRef.current);

      pendingHydrationIdsRef.current.clear();
      pendingHydrationSummariesRef.current.clear();
      clearPendingHydrationFlush();

      commitDeliverySummaries(runId, readyIds, summaries);
    },
    [clearPendingHydrationFlush, commitDeliverySummaries]
  );

  const scheduleHydrationFlush = useCallback(
    (runId: number) => {
      if (flushTimerRef.current !== null) {
        return;
      }

      flushTimerRef.current = window.setTimeout(() => {
        flushPendingHydration(runId);
      }, DELIVERY_SUMMARY_FLUSH_INTERVAL_MS);
    },
    [flushPendingHydration]
  );

  const hydrateDeliverySummaryBatch = useCallback(async (clientIds: string[], runId: number) => {
    if (clientIds.length === 0) {
      return;
    }

    const isFirstHydrationCommit =
      hydratedClientIdsRef.current.size === 0 && pendingHydrationIdsRef.current.size === 0;
    const summaries = await clientService.getClientDeliverySummaries(clientIds);
    if (hydrationRunIdRef.current !== runId) {
      return;
    }

    const readyIds = new Set(clientIds);
    clientIds.forEach((clientId) => hydratedClientIdsRef.current.add(clientId));

    if (isFirstHydrationCommit) {
      commitDeliverySummaries(runId, readyIds, summaries);
      return;
    }

    readyIds.forEach((clientId) => pendingHydrationIdsRef.current.add(clientId));
    summaries.forEach((summary, clientId) => {
      pendingHydrationSummariesRef.current.set(clientId, summary);
    });
    scheduleHydrationFlush(runId);
  }, [commitDeliverySummaries, scheduleHydrationFlush]);

  const scheduleDeliverySummaryHydration = useCallback(
    (baseClients: RowData[], runId: number) => {
      const clientIds = [...baseClients]
        .sort(compareRowsByName)
        .map((client) => client.uid)
        .filter((clientId) => !hydratedClientIdsRef.current.has(clientId));

      if (clientIds.length === 0) {
        return;
      }

      void (async () => {
        for (let index = 0; index < clientIds.length; index += DELIVERY_SUMMARY_BATCH_SIZE) {
          if (hydrationRunIdRef.current !== runId) {
            return;
          }

          const batch = clientIds.slice(index, index + DELIVERY_SUMMARY_BATCH_SIZE);
          await hydrateDeliverySummaryBatch(batch, runId);

          if (index + DELIVERY_SUMMARY_BATCH_SIZE < clientIds.length) {
            await wait(DELIVERY_SUMMARY_BATCH_DELAY_MS);
          }
        }

        flushPendingHydration(runId);
      })()
        .catch((err: unknown) => {
          if (hydrationRunIdRef.current !== runId) {
            return;
          }

          setError(
            err instanceof Error ? err : new Error("Failed to hydrate client delivery summaries.")
          );
        });
    },
    [flushPendingHydration, hydrateDeliverySummaryBatch]
  );

  const fetchClients = useCallback(async () => {
    if (inFlightRefreshRef.current) {
      return inFlightRefreshRef.current;
    }

    const request = (async () => {
      const runId = hydrationRunIdRef.current + 1;
      hydrationRunIdRef.current = runId;
      hydratedClientIdsRef.current = new Set();
      pendingHydrationSummariesRef.current = new Map();
      pendingHydrationIdsRef.current = new Set();
      clearPendingHydrationFlush();

      setLoading(true);
      setError(null);
      try {
        const result = await clientService.getBaseClientsForSpreadsheet();

        if (hydrationRunIdRef.current !== runId) {
          return;
        }

        setClients(result.clients);
        updateRefreshMetadata();
        setLoading(false);
        scheduleDeliverySummaryHydration(result.clients, runId);
      } catch (err: unknown) {
        if (hydrationRunIdRef.current === runId) {
          setError(err instanceof Error ? err : new Error("Failed to load clients."));
        }
      } finally {
        if (hydrationRunIdRef.current === runId) {
          setLoading(false);
        }
      }
    })();

    const dedupedRequest = request.finally(() => {
      inFlightRefreshRef.current = null;
    });

    inFlightRefreshRef.current = dedupedRequest;
    return dedupedRequest;
  }, [clearPendingHydrationFlush, scheduleDeliverySummaryHydration, updateRefreshMetadata]);

  const refreshIfNeeded = useCallback(async () => {
    if (typeof window === "undefined" || !window.localStorage) {
      await fetchClients();
      return;
    }

    const lastRefreshDate = window.localStorage.getItem("clientsLastRefreshDate");
    const forceRefresh = window.localStorage.getItem("forceClientsRefresh") === "true";

    if (forceRefresh || lastRefreshDate !== getTodayET()) {
      await fetchClients();
    }
  }, [fetchClients]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      inFlightRefreshRef.current = null;
      hydrationRunIdRef.current += 1;
      hydratedClientIdsRef.current = new Set();
      pendingHydrationSummariesRef.current = new Map();
      pendingHydrationIdsRef.current = new Set();
      clearPendingHydrationFlush();
      setClients([]);
      setError(null);
      setLoading(false);
      return;
    }

    void fetchClients();
  }, [authLoading, clearPendingHydrationFlush, user, fetchClients]);

  useEffect(() => {
    if (typeof window === "undefined" || !user) {
      return;
    }

    const handleFocus = () => {
      void refreshIfNeeded();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [user, refreshIfNeeded]);

  return (
    <ClientDataContext.Provider value={{ clients, loading, error, refresh: fetchClients }}>
      {children}
    </ClientDataContext.Provider>
  );
};

export const useClientData = () => {
  const ctx = useContext(ClientDataContext);
  if (!ctx) throw new Error("useClientData must be used within a ClientDataProvider");
  return ctx;
};
