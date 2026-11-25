import {
  executePaginatedEntityQuery,
  applyCommaSeparatedIdFilter,
  applyCommaSeparatedEnumFilter,
} from "@/lib/api-query";
import { handleApiRoute } from "@/lib/api-handler";
import {
  TICKET_STATUSES,
  ticketStatusEnum,
  AUTOMATIC_TICKET_SELECT_PROJECTION,
  type AutomaticTicket,
} from "@/app/tickets/types";
import { USER_ROLES } from "@/app/users/types";

const ALLOWED_SORT_COLUMNS = [
  "id",
  "concern",
  "reply",
  "status",
  "entry_id",
  "vehicle_number",
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
  return executePaginatedEntityQuery<(typeof ALLOWED_SORT_COLUMNS)[number], AutomaticTicket>({
    request,
    table: "automatic_tickets_view",
    select: AUTOMATIC_TICKET_SELECT_PROJECTION,
    allowedSortColumns: ALLOWED_SORT_COLUMNS,
    defaultSort: { col: "created_at", ascending: false },
    searchColumns: [
      "concern",
      "reply",
      "vehicle_number",
      "center_name",
      "creator_name",
      "creator_username",
    ],
    integerColumns: ["id"],
    enumColumns: [
      { column: "status", values: TICKET_STATUSES },
      { column: "creator_role", values: USER_ROLES },
    ],
    applyCustomFilters: (query, params) => {
      let filtered = applyCommaSeparatedEnumFilter(
        query,
        params.get("status"),
        "status",
        ticketStatusEnum,
      );
      filtered = applyCommaSeparatedIdFilter(
        filtered,
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
