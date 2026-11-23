import { supabase } from "@/lib/supabase";
import { executePaginatedEntityQuery } from "@/lib/api-query";
import { handleApiRoute } from "@/lib/api-handler";
import { ticketStatusEnum, TICKET_SELECT_PROJECTION, type Ticket } from "@/app/tickets/types";

const ALLOWED_SORT_COLUMNS = [
  "id",
  "concern",
  "reply",
  "status",
  "entry_id",
  "created_at",
  "updated_at",
] as const;

export const GET = handleApiRoute(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const extraOrConditions: string[] = [];

  if (search) {
    const { data: matchedEntries } = await supabase
      .from("entries")
      .select("id")
      .ilike("vehicle_number", `%${search}%`)
      .limit(100);

    if (matchedEntries && matchedEntries.length > 0) {
      const ids = matchedEntries.map((e) => e.id).join(",");
      extraOrConditions.push(`entry_id.in.(${ids})`);
    }
  }

  return executePaginatedEntityQuery<(typeof ALLOWED_SORT_COLUMNS)[number], Ticket>({
    request,
    table: "tickets",
    select: TICKET_SELECT_PROJECTION,
    allowedSortColumns: ALLOWED_SORT_COLUMNS,
    defaultSort: { col: "created_at", ascending: false },
    searchColumns: ["concern", "reply"],
    integerColumns: ["id", "entry_id"],
    extraOrConditions,
    applyCustomFilters: (query, params) => {
      const statusParam = params.get("status")?.trim();
      if (statusParam && statusParam !== "all") {
        const parsed = ticketStatusEnum.safeParse(statusParam);
        if (parsed.success) {
          return query.eq("status", parsed.data);
        }
      }
      return query;
    },
  });
});
