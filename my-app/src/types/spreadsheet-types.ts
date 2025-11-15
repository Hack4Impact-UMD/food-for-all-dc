import { RowData } from "../components/Spreadsheet/export";

export interface FieldDefinition {
  key: string;
  label: string;
  type: string;
  sortable?: boolean;
  compute?: (data: RowData) => any;
}
