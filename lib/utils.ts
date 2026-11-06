import axios from "axios";
export { cn } from "cn";

/**
 * Extracts a user-facing error message from an unknown error, prioritizing
 * Axios response error payloads and Error message properties with a fallback.
 */
export function getErrorMessage(err: unknown, fallback = "An unexpected error occurred."): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.message || fallback;
  }
  if (err instanceof Error) {
    return err.message || fallback;
  }
  return fallback;
}

/**
 * Standardizes ISO date-time string formatting across tables, cards, and audit logs.
 */
export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}
