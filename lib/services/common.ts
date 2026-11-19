/**
 * @file lib/services/common.ts
 * @description Service utilities for CRUD operations via backend API routes and axios.
 */

import axios from "axios";
import { ProjectSlug } from "@/lib/constants/enums";
import { type EntityRecord } from "@/types";
import { type PaginatedParams } from "./scoping";
import { ApiErrorMessage } from "@/lib/constants/messages";
import { useAuthStore } from "@/lib/store/auth";
import { AppRoutes } from "@/lib/constants";

export function getEndpoint(slug: ProjectSlug | string): string {
  return `/api/${slug}`;
}

export async function apiRequest<T>(requestFn: () => Promise<T>): Promise<T> {
  try {
    return await requestFn();
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        useAuthStore.getState().clearSession();
        if (
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith(AppRoutes.LOGIN)
        ) {
          const currentUrl = window.location.pathname + window.location.search;
          const redirectUrl = `${AppRoutes.LOGIN}?reason=session_expired&next=${encodeURIComponent(currentUrl)}`;
          window.location.href = redirectUrl;
        }
      }
      const serverError = error.response?.data?.error || error.response?.data?.message;
      if (serverError && typeof serverError === "string") {
        throw new Error(serverError);
      }
      if (error.response?.status === 405) {
        throw new Error(ApiErrorMessage.METHOD_NOT_ALLOWED);
      }
      if (error.response?.status === 403) {
        throw new Error(ApiErrorMessage.FORBIDDEN);
      }
      if (error.response?.status === 404) {
        throw new Error(ApiErrorMessage.RECORD_NOT_FOUND);
      }
    }
    throw error;
  }
}

export async function fetchEntityListFromApi<T = EntityRecord>(slug: ProjectSlug): Promise<T[]> {
  const endpoint = getEndpoint(slug);
  return apiRequest(async () => {
    const res = await axios.get<{ data: T[] }>(endpoint);
    return res.data.data;
  });
}

export async function fetchEntityPaginatedFromApi<T = EntityRecord>(
  slug: ProjectSlug,
  params: PaginatedParams,
): Promise<{ data: T[]; count: number }> {
  const endpoint = getEndpoint(slug);
  const { page, pageSize, search, filters, sortColumn, sortDesc } = params;
  return apiRequest(async () => {
    const res = await axios.get<{ data: T[]; pagination: { total: number } }>(endpoint, {
      params: {
        page: page + 1,
        limit: pageSize,
        search: search,
        sort_column: sortColumn,
        sort_desc: sortDesc,
        ...filters,
      },
    });
    return { data: res.data.data || [], count: res.data.pagination.total };
  });
}

export async function fetchEntityList(slug: ProjectSlug | string): Promise<EntityRecord[]> {
  return fetchEntityListFromApi(slug as ProjectSlug);
}

export async function fetchEntityListPaginated(
  slug: ProjectSlug,
  params: PaginatedParams,
): Promise<{ data: EntityRecord[]; count: number }> {
  return fetchEntityPaginatedFromApi(slug, params);
}

export async function insertRow(
  slug: ProjectSlug,
  record: Record<string, unknown> | FormData,
): Promise<EntityRecord> {
  const endpoint = getEndpoint(slug);
  return apiRequest(async () => {
    const res = await axios.post<{ data: EntityRecord }>(endpoint, record);
    return res.data.data;
  });
}

export async function updateRow(
  slug: ProjectSlug,
  id: number,
  record: Record<string, unknown> | FormData,
): Promise<EntityRecord> {
  const endpoint = getEndpoint(slug);
  return apiRequest(async () => {
    const url = `${endpoint}/${id}`;
    const res = await axios.patch<{
      data: EntityRecord;
      is_self_password_changed?: boolean;
    }>(url, record);
    const data = res.data.data;
    if (res.data.is_self_password_changed && data && typeof data === "object") {
      (data as unknown as Record<string, unknown>).is_self_password_changed = true;
    }
    return data;
  });
}

export async function deleteRow(slug: ProjectSlug, id: number): Promise<void> {
  const endpoint = getEndpoint(slug);
  return apiRequest(async () => {
    await axios.delete(`${endpoint}/${id}`);
  });
}

export async function deleteRows(slug: ProjectSlug, ids: number[]): Promise<number> {
  const endpoint = getEndpoint(slug);
  return apiRequest(async () => {
    const response = await axios.delete<{ deleted_count: number }>(endpoint, {
      data: { ids },
    });
    return response.data.deleted_count;
  });
}

/**
 * Strips PostgREST structural syntax characters to prevent filter AST injection in .or() clauses.
 */
export function sanitizeSearchTerm(term: string): string {
  if (!term || typeof term !== "string") return "";
  return term.replace(/[(),."':;\\]/g, "").trim();
}
