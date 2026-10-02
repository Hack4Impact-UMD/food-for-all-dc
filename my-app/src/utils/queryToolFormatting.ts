export const formatPhoneNumber = (value: unknown): string => {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const normalizePhoneNumber = (value: unknown): string => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
};

export const normalizeAssignedTime = (value: unknown): string => String(value ?? "").trim();

export const formatAssignedTime = (value: unknown): string => {
  const normalized = normalizeAssignedTime(value);
  if (!normalized) return "No time assigned";
  const [hours, minutes = "00"] = normalized.split(":");
  let hour = Number.parseInt(hours, 10);
  if (!Number.isFinite(hour)) return normalized;
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minutes} ${suffix}`;
};

export const formatDateMask = (value: unknown): string => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getMonth() + 1).padStart(2, "0")}/${String(value.getDate()).padStart(2, "0")}/${value.getFullYear()}`;
  }
  if (value && typeof value === "object" && typeof (value as { toDate?: unknown }).toDate === "function") {
    return formatDateMask((value as { toDate: () => Date }).toDate());
  }
  const text = String(value ?? "").trim();
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return `${isoMatch[2].padStart(2, "0")}/${isoMatch[3].padStart(2, "0")}/${isoMatch[1]}`;
  const digits = text.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export const parseQueryDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return null;

  const match = value.trim().match(/^(\d{2})[/-](\d{2})[/-](\d{4})$|^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[3] ?? match[4]);
  const month = Number(match[1] ?? match[5]);
  const day = Number(match[2] ?? match[6]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
};

export const isCompleteQueryDate = (value: unknown): boolean => {
  const date = parseQueryDate(value);
  return Boolean(
    date &&
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() >= 1000 &&
    date.getFullYear() <= 9999
  );
};
