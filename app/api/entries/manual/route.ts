import { executePaginatedEntityQuery, applyCommaSeparatedIdFilter } from "@/lib/api-query";
import { handleApiRoute } from "@/lib/api-handler";
import { MANUAL_ENTRY_SELECT_PROJECTION, type ManualEntry } from "@/app/entries/types";
import { USER_ROLES } from "@/app/users/types";

const ALLOWED_SORT_COLUMNS = [
  "id",
  "vehicle_number",
  "weight",
  "center_id",
  "center_name",
  "creator_id",
  "creator_name",
  "creator_username",
  "creator_role",
  "created_at",
  "updated_at",
] as const;

export const GET = handleApiRoute(async (request: Request) => {
  return executePaginatedEntityQuery<(typeof ALLOWED_SORT_COLUMNS)[number], ManualEntry>({
    request,
    table: "manual_entries_view",
    select: MANUAL_ENTRY_SELECT_PROJECTION,
    allowedSortColumns: ALLOWED_SORT_COLUMNS,
    defaultSort: { col: "created_at", ascending: false },
    searchColumns: ["vehicle_number", "center_name", "creator_name", "creator_username"],
    integerColumns: ["id"],
    numericColumns: ["weight"],
    enumColumns: [{ column: "creator_role", values: USER_ROLES }],
    integerFilterColumns: ["id"],
    applyCustomFilters: (query, params) => {
      let filtered = applyCommaSeparatedIdFilter(
        query,
        params.get("center_id") || params.get("center_ids"),
        "center_id",
      );
      filtered = applyCommaSeparatedIdFilter(
        filtered,
        params.get("creator_id") || params.get("creator_ids"),
        "creator_id",
      );
      return filtered;
    },
  });
});
