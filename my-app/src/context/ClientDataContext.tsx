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

const CLIENT_SPREADSHEET_INITIAL_PAGE_SIZE = 500;
const CLIENT_SPREADSHEET_PAGE_SIZE = 500;

const isSpreadsheetPerfDebugEnabled = (): boolean => {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    return window.localStorage.getItem("ffaSpreadsheetPerfDebug") === "1";
  } catch {
    return false;
  }
};

interface ClientDataContextType {
  clients: RowData[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  loadAllRemaining: () => Promise<RowData[]>;
  requestLoad: () => void;
}

const ClientDataContext = createContext<ClientDataContextType | undefined>(undefined);

export const ClientDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [clients, setClients] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchRequestIdRef = useRef(0);
  const inFlightFetchRef = useRef<Promise<void> | null>(null);
  const lastDocRef = useRef<any>(null);
  const hasMoreRef = useRef(false);
  const loadedClientIdsRef = useRef<Set<string>>(new Set());
  const clientsRef = useRef<RowData[]>([]);
  const loadAllRemainingInFlightRef = useRef<Promise<RowData[]> | null>(null);
  const [hasRequestedLoad, setHasRequestedLoad] = useState(false);
  const { user, loading: authLoading } = useAuth();

  const fetchPage = useCallback(async ({ reset }: { reset: boolean }) => {
    if (inFlightFetchRef.current) {
      return inFlightFetchRef.current;
    }

    const runFetch = async () => {
      const requestId = ++fetchRequestIdRef.current;
      const perfDebugEnabled = isSpreadsheetPerfDebugEnabled();
      const fetchStartTime = perfDebugEnabled ? performance.now() : 0;

      if (reset) {
        setLoading(true);
        setError(null);
        setHasMore(false);
        hasMoreRef.current = false;
      } else {
        if (!hasMoreRef.current) {
          return;
        }
        setLoadingMore(true);
      }

      try {
        const pageSize = reset ? CLIENT_SPREADSHEET_INITIAL_PAGE_SIZE : CLIENT_SPREADSHEET_PAGE_SIZE;
        const pageResult = await clientService.getAllClientsForSpreadsheet(
          pageSize,
          reset ? undefined : lastDocRef.current
        );

        if (requestId !== fetchRequestIdRef.current) {
          return;
        }

        if (reset) {
          loadedClientIdsRef.current = new Set();
        }

        const newRows = pageResult.clients.filter((row) => !loadedClientIdsRef.current.has(row.uid));
        newRows.forEach((row) => loadedClientIdsRef.current.add(row.uid));

        setClients((previousClients) => {
          let nextClients: RowData[];
          if (reset) {
            nextClients = newRows;
          } else if (newRows.length === 0) {
            nextClients = previousClients;
          } else {
            const existingIds = new Set(previousClients.map((client) => client.uid));
            const uniqueRows = newRows.filter((row) => !existingIds.has(row.uid));
            nextClients =
              uniqueRows.length === 0 ? previousClients : [...previousClients, ...uniqueRows];
          }
          clientsRef.current = nextClients;
          return nextClients;
        });

        lastDocRef.current = pageResult.lastDoc;
        const hasAdditionalPages = !!pageResult.lastDoc && pageResult.clients.length >= pageSize;
        hasMoreRef.current = hasAdditionalPages;
        setHasMore(hasAdditionalPages);

        if (perfDebugEnabled) {
          const totalDurationMs = Math.round(performance.now() - fetchStartTime);
          console.info(
            `[SpreadsheetPerf] pageFetchMs=${totalDurationMs} rows=${newRows.length} reset=${reset} hasMore=${hasAdditionalPages}`
          );
        }
      } catch (err: any) {
        if (requestId !== fetchRequestIdRef.current) {
          return;
        }

        setError(err);
      } finally {
        if (requestId === fetchRequestIdRef.current) {
          if (reset) {
            setLoading(false);
          } else {
            setLoadingMore(false);
          }
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

  const fetchClients = useCallback(async () => {
    lastDocRef.current = null;
    return fetchPage({ reset: true });
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMoreRef.current) {
      return;
    }
    await fetchPage({ reset: false });
  }, [fetchPage, loading, loadingMore]);

  const loadAllRemaining = useCallback(async (): Promise<RowData[]> => {
    if (loadAllRemainingInFlightRef.current) {
      return loadAllRemainingInFlightRef.current;
    }

    const runLoadAllRemaining = async (): Promise<RowData[]> => {
      if (inFlightFetchRef.current) {
        await inFlightFetchRef.current;
      }

      if (!hasMoreRef.current) {
        return clientsRef.current;
      }

      const requestId = ++fetchRequestIdRef.current;
      const perfDebugEnabled = isSpreadsheetPerfDebugEnabled();
      const fetchStartTime = perfDebugEnabled ? performance.now() : 0;

      setLoadingMore(true);

      try {
        const accumulatedRows: RowData[] = [];
        const loadedIds = new Set(loadedClientIdsRef.current);
        let currentLastDoc = lastDocRef.current;
        let hasAdditionalPages: boolean = hasMoreRef.current;

        while (hasAdditionalPages) {
          const pageResult = await clientService.getAllClientsForSpreadsheet(
            CLIENT_SPREADSHEET_PAGE_SIZE,
            currentLastDoc
          );

          if (requestId !== fetchRequestIdRef.current) {
            throw new Error("Client export was interrupted by a newer refresh.");
          }

          const freshRows = pageResult.clients.filter((row) => !loadedIds.has(row.uid));
          freshRows.forEach((row) => loadedIds.add(row.uid));
          accumulatedRows.push(...freshRows);

          currentLastDoc = pageResult.lastDoc;
          hasAdditionalPages =
            !!pageResult.lastDoc &&
            pageResult.clients.length >= CLIENT_SPREADSHEET_PAGE_SIZE;
        }

        loadedClientIdsRef.current = loadedIds;
        lastDocRef.current = currentLastDoc;
        hasMoreRef.current = false;
        setHasMore(false);

        if (accumulatedRows.length > 0) {
          const nextClients = [...clientsRef.current, ...accumulatedRows];
          clientsRef.current = nextClients;
          setClients(nextClients);
        }

        if (perfDebugEnabled) {
          const totalDurationMs = Math.round(performance.now() - fetchStartTime);
          console.info(
            `[SpreadsheetPerf] loadAllRemainingMs=${totalDurationMs} rows=${accumulatedRows.length}`
          );
        }

        return clientsRef.current;
      } catch (err: any) {
        if (requestId === fetchRequestIdRef.current) {
          setError(err);
        }
        throw err;
      } finally {
        if (requestId === fetchRequestIdRef.current) {
          setLoadingMore(false);
        }
      }
    };

    const loadPromise = runLoadAllRemaining();
    loadAllRemainingInFlightRef.current = loadPromise;
    try {
      return await loadPromise;
    } finally {
      if (loadAllRemainingInFlightRef.current === loadPromise) {
        loadAllRemainingInFlightRef.current = null;
      }
    }
  }, []);

  const requestLoad = useCallback(() => {
    setHasRequestedLoad(true);
  }, []);

  useEffect(() => {
    if (!authLoading && user && hasRequestedLoad && clients.length === 0 && !loading) {
      fetchClients();
    }
  }, [authLoading, user, hasRequestedLoad, clients.length, loading, fetchClients]);

  return (
    <ClientDataContext.Provider
      value={{
        clients,
        loading,
        loadingMore,
        hasMore,
        error,
        refresh: fetchClients,
        loadMore,
        loadAllRemaining,
        requestLoad,
      }}
    >
      {children}
    </ClientDataContext.Provider>
  );
};

export const useClientData = ({ autoLoad = true }: { autoLoad?: boolean } = {}) => {
  const ctx = useContext(ClientDataContext);
  if (!ctx) throw new Error("useClientData must be used within a ClientDataProvider");

  useEffect(() => {
    if (autoLoad) {
      ctx.requestLoad();
    }
  }, [autoLoad, ctx]);

  return ctx;
};
