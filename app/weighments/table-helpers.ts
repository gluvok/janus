import { z } from "zod";
import axios from "axios";
import type { FacetedFilterOption } from "@/components/data-table";
import { appIcons } from "@/lib/icons";
import type { Center } from "@/app/centers/types";
import type { User } from "@/app/users/types";
import type { TableItemState } from "@/lib/table-strategy";
import type { EntityMode } from "@/stores/use-mode-store";

function formatEntityOptions<T extends { id: number; name: string }>(
  items: T[],
  title: string,
  icon: FacetedFilterOption["icon"],
): FacetedFilterOption[] {
  return [
    { label: `All ${title}`, value: "all", icon },
    ...items.map((item) => ({
      idPrefix: `#${item.id}`,
      label: item.name,
      value: String(item.id),
    })),
  ];
}

export function formatCenterOptions(centers: Center[], title: string): FacetedFilterOption[] {
  return formatEntityOptions(centers, title, appIcons.centers);
}

export function formatUserOptions(users: User[], title: string): FacetedFilterOption[] {
  return formatEntityOptions(users, title, appIcons.users);
}

export async function fetchFilterOptions(mode: EntityMode) {
  const centersPromise = axios.get<{ data: Center[] }>("/api/centers?all=true&sort=name.asc");
  const usersPromise =
    mode === "manual"
      ? axios.get<{ data: User[] }>("/api/users?all=true&sort=name.asc")
      : Promise.resolve(null);

  const [centersRes, usersRes] = await Promise.all([centersPromise, usersPromise]);

  return {
    centers: centersRes.data.data ?? [],
    users: usersRes?.data.data ?? [],
  };
}

function createFilterSanitizerSchema(validIds: Set<string>) {
  return z.string().transform((val) => {
    if (!val || val === "all") return "all";
    const ids = val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const valid = ids.filter((id) => validIds.has(id));
    return valid.length === 0 ? "all" : valid.join(",");
  });
}

export function validateAndSanitizeFilters(
  currentFilters: Record<string, string>,
  centers: Center[],
  users: User[],
  mode: EntityMode,
  onReset: (key: string, value: string) => void,
): { sanitizedFilters: Record<string, string>; needsFallback: boolean } {
  let needsFallback = false;
  const sanitizedFilters = { ...currentFilters };
  const centerIds = new Set(centers.map((c) => String(c.id)));
  const dynamicEntityChecks: Array<{ key: string; validIds: Set<string> }> = [
    { key: "in_center_id", validIds: centerIds },
    { key: "out_center_id", validIds: centerIds },
  ];

  if (mode === "manual") {
    const userIds = new Set(users.map((u) => String(u.id)));
    dynamicEntityChecks.push(
      { key: "in_creator_id", validIds: userIds },
      { key: "out_creator_id", validIds: userIds },
    );
  }

  for (const { key, validIds } of dynamicEntityChecks) {
    const filterVal = sanitizedFilters[key];
    if (filterVal && filterVal !== "all") {
      const schema = createFilterSanitizerSchema(validIds);
      const parsed = schema.safeParse(filterVal);
      if (parsed.success) {
        if (parsed.data !== filterVal) {
          sanitizedFilters[key] = parsed.data;
          needsFallback = true;
          onReset(key, parsed.data);
        }
      } else {
        sanitizedFilters[key] = "all";
        onReset(key, "all");
        needsFallback = true;
      }
    }
  }

  return { sanitizedFilters, needsFallback };
}

export function buildWeighmentsQueryParams(
  tableState: TableItemState,
  page: number,
  filters: Record<string, string>,
): Record<string, unknown> {
  const pagination = tableState.pagination;
  const sorting = tableState.sorting;
  const search = tableState.search;
  const fromIso = tableState.dateRange?.from;
  const toIso = tableState.dateRange?.to;

  return {
    page,
    pageSize: pagination.pageSize,
    ...(sorting.length > 0 && {
      sort: sorting.map((s) => `${s.id}.${s.desc ? "desc" : "asc"}`).join(","),
    }),
    ...(search && { search }),
    ...(fromIso && { from: fromIso }),
    ...(toIso && { to: toIso }),
    ...filters,
  };
}
