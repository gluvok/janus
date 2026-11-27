import axios from "axios";
export { cn } from "cn";

/** Prefers the API error payload, then the error message, then `fallback`. */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.message || fallback;
  }
  if (err instanceof Error) {
    return err.message || fallback;
  }
  return fallback;
}

/** Formats an ISO date-time string for display; returns "—" when empty. */
export function formatDateTime(isoString: string | null): string {
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
