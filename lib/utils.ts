import axios from "axios";
export { cn } from "cn";

/**
 * Global Axios interceptor for handling 401 Unauthorized responses.
 * Redirects the user to /login?next=<current_path> when session expires.
 */
if (typeof window !== "undefined") {
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401 && !window.location.pathname.startsWith("/login")) {
        const target = window.location.pathname + window.location.search;
        const nextParam = target && target !== "/" ? `?next=${encodeURIComponent(target)}` : "";
        window.location.href = `/login${nextParam}`;
      }
      return Promise.reject(error);
    },
  );
}

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
