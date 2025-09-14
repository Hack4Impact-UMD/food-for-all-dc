import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { clientService } from '../services/client-service';
import { RowData } from '../components/Spreadsheet/export';

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
  const { user, loading: authLoading } = useAuth();

  const fetchClients = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await clientService.getAllClientsForSpreadsheet();
      setClients(result.clients);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchClients();
    }
  }, [authLoading, user]);

  return (
    <ClientDataContext.Provider value={{ clients, loading, error, refresh: fetchClients }}>
      {children}
    </ClientDataContext.Provider>
  );
};

export const useClientData = () => {
  const ctx = useContext(ClientDataContext);
  if (!ctx) throw new Error('useClientData must be used within a ClientDataProvider');
  return ctx;
};
