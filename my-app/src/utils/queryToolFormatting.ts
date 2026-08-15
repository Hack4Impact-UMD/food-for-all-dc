export const formatPhoneNumber = (value: unknown): string => {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const normalizePhoneNumber = (value: unknown): string =>
  String(value ?? "").replace(/\D/g, "");

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
