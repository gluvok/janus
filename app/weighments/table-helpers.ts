import { z } from "zod";
import axios from "axios";
import type { FacetedFilterOption } from "@/components/data-table";
import { appIcons } from "@/lib/icons";
import type { Center } from "@/app/centers/types";
import type { TableItemState } from "@/lib/table-strategy";

export function formatCenterOptions(centers: Center[], title: string): FacetedFilterOption[] {
  return [
    { label: `All ${title}`, value: "all", icon: appIcons.centers },
    ...centers.map((c) => ({
      idPrefix: `#${c.id}`,
      label: c.name,
      value: String(c.id),
    })),
  ];
}

export async function fetchFilterOptions() {
  const centersRes = await axios.get<{ data: Center[] }>("/api/centers?all=true&sort=name.asc");
  return {
    centers: centersRes.data.data ?? [],
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
  onReset: (key: string) => void,
): { sanitizedFilters: Record<string, string>; needsFallback: boolean } {
  let needsFallback = false;
  const sanitizedFilters = { ...currentFilters };
  const dynamicEntityChecks: Array<{ key: string; validIds: Set<string> }> = [
    { key: "in_center_id", validIds: new Set(centers.map((c) => String(c.id))) },
    { key: "out_center_id", validIds: new Set(centers.map((c) => String(c.id))) },
  ];

  for (const { key, validIds } of dynamicEntityChecks) {
    const filterVal = sanitizedFilters[key];
    if (filterVal && filterVal !== "all") {
      const schema = createFilterSanitizerSchema(validIds);
      const parsed = schema.safeParse(filterVal);
      if (parsed.success) {
        if (parsed.data !== filterVal) {
          sanitizedFilters[key] = parsed.data;
          needsFallback = true;
          if (parsed.data === "all") {
            onReset(key);
          }
        }
      } else {
        sanitizedFilters[key] = "all";
        onReset(key);
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
