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