import { CsvRow, downloadCsv } from "./csvExport";

export const exportToCSV = (data: CsvRow[], filename: string) => downloadCsv(data, filename);

export const formatDateRange = (startDate: Date | null, endDate: Date | null): string => {
  if (!startDate || !endDate) return "";

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return `${formatDate(startDate)}_to_${formatDate(endDate)}`;
};

export const getReportRangeKey = (startDate: Date | null, endDate: Date | null): string =>
  formatDateRange(startDate, endDate);

export const isReportExportDisabled = ({
  isLoading,
  hasGenerated,
  generatedRangeKey,
  currentRangeKey,
}: {
  isLoading: boolean;
  hasGenerated: boolean;
  generatedRangeKey: string;
  currentRangeKey: string;
}): boolean =>
  isLoading || !hasGenerated || !currentRangeKey || generatedRangeKey !== currentRangeKey;
