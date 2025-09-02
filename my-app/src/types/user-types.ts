// Type definitions for users, staff, and related entities

export interface CaseWorker {
  id: string;
  name: string;
  organization: string;
  phone: string;
  email: string;
}

export interface ValidationErrors {
  name?: string;
  organization?: string;
  phone?: string;
  email?: string;
}

export interface CaseWorkerFormProps {
  value: Omit<CaseWorker, "id">;
  onChange: (field: keyof Omit<CaseWorker, "id">, value: string) => void;
  errors: ValidationErrors;
  onClearError: (field: keyof ValidationErrors) => void;
}

export interface CaseWorkerManagementModalProps {
  open: boolean;
  onClose: () => void;
  caseWorkers: CaseWorker[];
  onCaseWorkersChange: (caseWorkers: CaseWorker[]) => void;
}

// --- Authentication Types ---
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  emailVerified: boolean;
  phoneNumber?: string | null;
  providerId?: string;
}

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error?: AuthError | null;
}

export interface AuthError {
  code: string;
  message: string;
}
