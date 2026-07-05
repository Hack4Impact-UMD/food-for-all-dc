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
  loadAllRemaining: () => Promise<void>;
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
  const hasAttemptedInitialLoadRef = useRef(false);
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
          if (reset) {
            return newRows;
          }

          if (newRows.length === 0) {
            return previousClients;
          }

          const existingIds = new Set(previousClients.map((client) => client.uid));
          const uniqueRows = newRows.filter((row) => !existingIds.has(row.uid));
          if (uniqueRows.length === 0) {
            return previousClients;
          }

          return [...previousClients, ...uniqueRows];
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
    hasAttemptedInitialLoadRef.current = true;
    lastDocRef.current = null;
    return fetchPage({ reset: true });
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMoreRef.current) {
      return;
    }
    await fetchPage({ reset: false });
  }, [fetchPage, loading, loadingMore]);

  const loadAllRemaining = useCallback(async () => {
    if (loading || loadingMore || !hasMoreRef.current) {
      return;
    }

    if (inFlightFetchRef.current) {
      await inFlightFetchRef.current;
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
          return;
        }

        const freshRows = pageResult.clients.filter((row) => !loadedIds.has(row.uid));
        freshRows.forEach((row) => loadedIds.add(row.uid));
        accumulatedRows.push(...freshRows);

        currentLastDoc = pageResult.lastDoc;
        hasAdditionalPages = !!pageResult.lastDoc && pageResult.clients.length >= CLIENT_SPREADSHEET_PAGE_SIZE;
      }

      loadedClientIdsRef.current = loadedIds;
      lastDocRef.current = currentLastDoc;
      hasMoreRef.current = false;
      setHasMore(false);

      if (accumulatedRows.length > 0) {
        setClients((previousClients) => [...previousClients, ...accumulatedRows]);
      }

      if (perfDebugEnabled) {
        const totalDurationMs = Math.round(performance.now() - fetchStartTime);
        console.info(
          `[SpreadsheetPerf] loadAllRemainingMs=${totalDurationMs} rows=${accumulatedRows.length}`
        );
      }
    } catch (err: any) {
      if (requestId !== fetchRequestIdRef.current) {
        return;
      }

      setError(err);
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setLoadingMore(false);
      }
    }
  }, [loading, loadingMore]);

  const requestLoad = useCallback(() => {
    setHasRequestedLoad(true);
  }, []);

  useEffect(() => {
    hasAttemptedInitialLoadRef.current = false;
  }, [user?.uid]);

  useEffect(() => {
    if (
      !authLoading &&
      user &&
      hasRequestedLoad &&
      !hasAttemptedInitialLoadRef.current &&
      clients.length === 0 &&
      !loading
    ) {
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
