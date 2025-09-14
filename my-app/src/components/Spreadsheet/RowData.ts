// Minimal RowData type for external use (update as needed)
export type RowData = {
  id: string;
  uid?: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  phone?: string;
  [key: string]: any;
};
