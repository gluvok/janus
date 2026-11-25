import { executePaginatedEntityQuery, applyCommaSeparatedIdFilter } from "@/lib/api-query";
import { handleApiRoute } from "@/lib/api-handler";
import { ticketStatusEnum, TICKET_SELECT_PROJECTION, type Ticket } from "@/app/tickets/types";

const ALLOWED_SORT_COLUMNS = [
  "id",
  "concern",
  "reply",
  "status",
  "entry_id",
  "vehicle_number",
  "creator_id",
  "creator_name",
  "created_at",
  "updated_at",
] as const;

export const GET = handleApiRoute(async (request: Request) => {
  return executePaginatedEntityQuery<(typeof ALLOWED_SORT_COLUMNS)[number], Ticket>({
    request,
    table: "automatic_tickets_view",
    select: TICKET_SELECT_PROJECTION,
    allowedSortColumns: ALLOWED_SORT_COLUMNS,
    defaultSort: { col: "created_at", ascending: false },
    searchColumns: ["concern", "reply", "vehicle_number", "creator_name", "creator_username"],
    integerColumns: ["id", "entry_id", "creator_id"],
    applyCustomFilters: (query, params) => {
      let filtered = query;
      const statusParam = params.get("status")?.trim();
      if (statusParam && statusParam !== "all") {
        const parsed = ticketStatusEnum.safeParse(statusParam);
        if (parsed.success) {
          filtered = filtered.eq("status", parsed.data);
        }
      }
      filtered = applyCommaSeparatedIdFilter(filtered, params.get("creator_id"), "creator_id");
      return filtered;
    },
  });
});
