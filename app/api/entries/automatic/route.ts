import { executePaginatedEntityQuery, applyCommaSeparatedIdFilter } from "@/lib/api-query";
import { handleApiRoute } from "@/lib/api-handler";
import { AUTOMATIC_ENTRY_SELECT_PROJECTION, type AutomaticEntry } from "@/app/entries/types";

const ALLOWED_SORT_COLUMNS = [
  "id",
  "vehicle_number",
  "weight",
  "center_id",
  "center_name",
  "created_at",
  "updated_at",
] as const;

export const GET = handleApiRoute(async (request: Request) => {
  return executePaginatedEntityQuery<(typeof ALLOWED_SORT_COLUMNS)[number], AutomaticEntry>({
    request,
    table: "automatic_entries_view",
    select: AUTOMATIC_ENTRY_SELECT_PROJECTION,
    allowedSortColumns: ALLOWED_SORT_COLUMNS,
    defaultSort: { col: "created_at", ascending: false },
    searchColumns: ["vehicle_number", "idempotency_key", "center_name"],
    integerColumns: ["id", "center_id"],
    numericColumns: ["weight"],
    applyCustomFilters: (query, params) =>
      applyCommaSeparatedIdFilter(
        query,
        params.get("center_id") || params.get("center_ids"),
        "center_id",
      ),
  });
});
