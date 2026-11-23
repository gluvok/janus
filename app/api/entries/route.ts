import { z } from "zod";
import { executePaginatedEntityQuery } from "@/lib/api-query";
import { handleApiRoute } from "@/lib/api-handler";
import { ENTRY_SELECT_PROJECTION, type Entry } from "@/app/entries/types";

const ALLOWED_SORT_COLUMNS = [
  "id",
  "vehicle_number",
  "weight",
  "center_name",
  "created_at",
  "updated_at",
] as const;

const commaSeparatedIdsSchema = z
  .string()
  .transform((val) =>
    val
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0),
  )
  .pipe(z.array(z.number().int().positive()));

export const GET = handleApiRoute(async (request: Request) => {
  return executePaginatedEntityQuery<(typeof ALLOWED_SORT_COLUMNS)[number], Entry>({
    request,
    table: "entries_view",
    select: ENTRY_SELECT_PROJECTION,
    allowedSortColumns: ALLOWED_SORT_COLUMNS,
    defaultSort: { col: "created_at", ascending: false },
    searchColumns: ["vehicle_number", "idempotency_key", "center_name", "creator_name"],
    integerColumns: ["id", "center_id", "creator_id"],
    numericColumns: ["weight"],
    applyCustomFilters: (query, params) => {
      let filtered = query;

      // Filter by center
      const centerParam = params.get("center_id") || params.get("center_ids");
      if (centerParam && centerParam !== "all") {
        const parsed = commaSeparatedIdsSchema.safeParse(centerParam);
        if (parsed.success && parsed.data.length > 0) {
          filtered = filtered.in("center_id", parsed.data);
        }
      }

      return filtered;
    },
  });
});
