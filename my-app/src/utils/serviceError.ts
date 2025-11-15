export class ServiceError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code = "service-error", details?: unknown) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}

export function formatServiceError(
  error: any,
  fallbackMessage = "An unexpected error occurred."
): ServiceError {
  if (error instanceof ServiceError) return error;
  if (error && typeof error === "object" && error.message) {
    // Always use fallbackMessage for the error message
    return new ServiceError(fallbackMessage, error.code || "service-error", error);
  }
  return new ServiceError(fallbackMessage);
}
