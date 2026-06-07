import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import { clientService } from "../services/client-service";
import { RowData } from "../components/Spreadsheet/export";

const CLIENT_SPREADSHEET_PAGE_SIZE = 5000;
const DELIVERY_SUMMARY_HYDRATION_BATCH_SIZE = 300;
const DELIVERY_SUMMARY_HYDRATION_CONCURRENCY = 3;
const DIRECT_SUMMARY_HYDRATION_MAX_IDS = 3000;
const SUMMARY_HYDRATION_RETRY_DELAYS_MS = [1200, 3000] as const;
const SUMMARY_HYDRATION_FOLLOW_UP_DELAY_MS = 12000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isSpreadsheetPerfDebugEnabled = (): boolean => {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  return window.localStorage.getItem("ffaSpreadsheetPerfDebug") === "1";
};

interface ClientDataContextType {
  clients: RowData[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const ClientDataContext = createContext<ClientDataContextType | undefined>(undefined);

export const ClientDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [clients, setClients] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetchRequestIdRef = useRef(0);
  const inFlightFetchRef = useRef<Promise<void> | null>(null);
  const { user, loading: authLoading } = useAuth();

  const fetchClients = useCallback(async () => {
    if (inFlightFetchRef.current) {
      return inFlightFetchRef.current;
    }

    const runFetch = async () => {
    const requestId = ++fetchRequestIdRef.current;
    const perfDebugEnabled = isSpreadsheetPerfDebugEnabled();
    const fetchStartTime = perfDebugEnabled ? performance.now() : 0;
    const baseFetchStartTime = perfDebugEnabled ? performance.now() : 0;

    setLoading(true);
    setError(null);

    try {
      const allClients: RowData[] = [];
      let lastDoc: any = undefined;
      let hasMoreClients = true;
      let basePageCount = 0;

      // Transparently page through all clients so large datasets still load completely.
      while (hasMoreClients) {
        basePageCount += 1;
        const result = await clientService.getBaseClientsForSpreadsheet(
          CLIENT_SPREADSHEET_PAGE_SIZE,
          lastDoc
        );
        allClients.push(...result.clients);

        if (!result.lastDoc || result.clients.length < CLIENT_SPREADSHEET_PAGE_SIZE) {
          hasMoreClients = false;
          continue;
        }

        lastDoc = result.lastDoc;
      }

      if (perfDebugEnabled) {
        const baseFetchDurationMs = Math.round(performance.now() - baseFetchStartTime);
        console.info(
          `[SpreadsheetPerf] baseFetchMs=${baseFetchDurationMs} rows=${allClients.length} pages=${basePageCount}`
        );
      }

      if (requestId !== fetchRequestIdRef.current) {
        return;
      }

      setClients(allClients);

      // End initial loading after base rows are ready; summaries hydrate in background.
      setLoading(false);

      const allClientIds = allClients.map((client) => client.uid).filter(Boolean);
      if (allClientIds.length === 0) {
        if (perfDebugEnabled) {
          const totalDurationMs = Math.round(performance.now() - fetchStartTime);
          console.info(`[SpreadsheetPerf] totalFetchMs=${totalDurationMs} rows=0`);
        }
        return;
      }

      const hydrateSummaries = async (attemptLabel: string): Promise<"applied" | "stale"> => {
        const summaryHydrationStartTime = perfDebugEnabled ? performance.now() : 0;
        const combinedSummaries = new Map<
          string,
          { lastDeliveryDate: string; missedStrikeCount: number }
        >();
        let summaryBatchCount = 1;

        if (allClientIds.length <= DIRECT_SUMMARY_HYDRATION_MAX_IDS) {
          const allSummaries = await clientService.getClientDeliverySummaries(allClientIds);
          allSummaries.forEach((summary, clientId) => {
            combinedSummaries.set(clientId, summary);
          });
        } else {
          const summaryBatches: string[][] = [];

          for (let i = 0; i < allClientIds.length; i += DELIVERY_SUMMARY_HYDRATION_BATCH_SIZE) {
            summaryBatches.push(allClientIds.slice(i, i + DELIVERY_SUMMARY_HYDRATION_BATCH_SIZE));
          }
          summaryBatchCount = summaryBatches.length;

          for (let i = 0; i < summaryBatches.length; i += DELIVERY_SUMMARY_HYDRATION_CONCURRENCY) {
            const concurrentBatches = summaryBatches.slice(
              i,
              i + DELIVERY_SUMMARY_HYDRATION_CONCURRENCY
            );

            const batchResults = await Promise.all(
              concurrentBatches.map((clientIdBatch) =>
                clientService.getClientDeliverySummaries(clientIdBatch)
              )
            );

            batchResults.forEach((batchSummaries) => {
              batchSummaries.forEach((summary, clientId) => {
                combinedSummaries.set(clientId, summary);
              });
            });
          }
        }

        if (perfDebugEnabled) {
          const summaryHydrationDurationMs = Math.round(
            performance.now() - summaryHydrationStartTime
          );
          console.info(
            `[SpreadsheetPerf] summaryHydrationMs=${summaryHydrationDurationMs} ids=${allClientIds.length} batches=${summaryBatchCount} attempt=${attemptLabel}`
          );
        }

        if (requestId !== fetchRequestIdRef.current) {
          return "stale";
        }

        setClients((previousClients) =>
          previousClients.map((client) => {
            const summary = combinedSummaries.get(client.uid);
            return {
              ...client,
              lastDeliveryDate: summary?.lastDeliveryDate ?? "",
              missedStrikeCount: summary?.missedStrikeCount ?? 0,
              deliverySummaryReady: true,
            };
          })
        );

        return "applied";
      };

      let hydrationState: "applied" | "stale" | "failed" = "failed";

      try {
        hydrationState = await hydrateSummaries("initial");
      } catch (hydrationError) {
        if (requestId === fetchRequestIdRef.current && perfDebugEnabled) {
          const message =
            hydrationError instanceof Error ? hydrationError.message : String(hydrationError);
          console.warn(`[SpreadsheetPerf] summaryHydrationError attempt=initial message=${message}`);
        }
      }

      for (let retryIndex = 0; retryIndex < SUMMARY_HYDRATION_RETRY_DELAYS_MS.length; retryIndex += 1) {
        if (hydrationState !== "failed") {
          break;
        }

        if (requestId !== fetchRequestIdRef.current) {
          return;
        }

        const delayMs = SUMMARY_HYDRATION_RETRY_DELAYS_MS[retryIndex];
        await sleep(delayMs);

        if (requestId !== fetchRequestIdRef.current) {
          return;
        }

        try {
          hydrationState = await hydrateSummaries(`retry-${retryIndex + 1}`);
        } catch (hydrationError) {
          if (requestId === fetchRequestIdRef.current && perfDebugEnabled) {
            const message =
              hydrationError instanceof Error ? hydrationError.message : String(hydrationError);
            console.warn(
              `[SpreadsheetPerf] summaryHydrationError attempt=retry-${retryIndex + 1} message=${message}`
            );
          }
        }
      }

      if (hydrationState === "stale") {
        return;
      }

      if (hydrationState === "failed") {
        if (perfDebugEnabled) {
          console.warn("[SpreadsheetPerf] summaryHydrationExhausted retries=2");
        }

        // Run one delayed follow-up attempt without blocking UI load.
        void (async () => {
          await sleep(SUMMARY_HYDRATION_FOLLOW_UP_DELAY_MS);

          if (requestId !== fetchRequestIdRef.current) {
            return;
          }

          try {
            await hydrateSummaries("follow-up");
          } catch (hydrationError) {
            if (requestId === fetchRequestIdRef.current && perfDebugEnabled) {
              const message =
                hydrationError instanceof Error ? hydrationError.message : String(hydrationError);
              console.warn(
                `[SpreadsheetPerf] summaryHydrationError attempt=follow-up message=${message}`
              );
            }
          }
        })();
      }

      if (perfDebugEnabled) {
        const totalDurationMs = Math.round(performance.now() - fetchStartTime);
        console.info(`[SpreadsheetPerf] totalFetchMs=${totalDurationMs} rows=${allClients.length}`);
      }
    } catch (err: any) {
      if (requestId !== fetchRequestIdRef.current) {
        return;
      }

      setError(err);
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setLoading(false);
      }
    }
    };

    inFlightFetchRef.current = runFetch();

    try {
      await inFlightFetchRef.current;
    } finally {
      inFlightFetchRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      fetchClients();
    }
  }, [authLoading, user, fetchClients]);

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
