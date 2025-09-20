export interface ReportField {
  key: string,
  value: number,
  isFullRow: boolean
}

export interface SummaryData {
  [section: string]: { [field: string]: { value: number; isFullRow: boolean } } 
}