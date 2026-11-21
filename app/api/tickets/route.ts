import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { executePaginatedEntityQuery } from "@/lib/api-query";
import {
  handleApiRoute,
  ServiceError,
  validationErrorResponse,
  type ApiContext,
} from "@/lib/api-handler";
import {
  ticketStatusEnum,
  updateTicketSchema,
  deleteTicketSchema,
  TICKET_SELECT_PROJECTION,
  type Ticket,
} from "@/app/tickets/types";

const ALLOWED_SORT_COLUMNS = [
  "id",
  "concern",
  "reply",
  "status",
  "automatic_weighment_id",
  "user_id",
  "created_at",
  "updated_at",
] as const;

async function findTicketForFactory(id: number, factoryId: number) {
  const { data: ticket, error: findError } = await supabase
    .from("tickets")
    .select("id, status, user:users!user_id!inner(factory_id)")
    .eq("id", id)
    .eq("user.factory_id", factoryId)
    .maybeSingle();

  if (findError) {
    throw new ServiceError(findError.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  if (!ticket) {
    throw new ServiceError("Ticket not found or has been deleted.", StatusCodes.NOT_FOUND);
  }

  return ticket;
}

export const GET = handleApiRoute(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const extraOrConditions: string[] = [];

  if (search) {
    const { data: matchedWeighments } = await supabase
      .from("automatic_weighments")
      .select("id")
      .ilike("vehicle_number", `%${search}%`)
      .limit(100);

    if (matchedWeighments && matchedWeighments.length > 0) {
      const ids = matchedWeighments.map((w) => w.id).join(",");
      extraOrConditions.push(`automatic_weighment_id.in.(${ids})`);
    }
  }

  return executePaginatedEntityQuery<(typeof ALLOWED_SORT_COLUMNS)[number], Ticket>({
    request,
    table: "tickets",
    select: TICKET_SELECT_PROJECTION,
    allowedSortColumns: ALLOWED_SORT_COLUMNS,
    defaultSort: { col: "created_at", ascending: false },
    searchColumns: ["concern", "reply"],
    integerColumns: ["id", "automatic_weighment_id"],
    extraOrConditions,
    applyCustomFilters: (query, searchParams) => {
      const statusParam = searchParams.get("status")?.trim();
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

export const PATCH = handleApiRoute(async (request: Request, context: ApiContext) => {
  const validation = updateTicketSchema.safeParse(await request.json());

  if (!validation.success) {
    return validationErrorResponse(validation.error);
  }

  const { id, concern } = validation.data;
  const ticket = await findTicketForFactory(id, context.factory.id);

  if (ticket.status !== "pending") {
    throw new ServiceError("Only pending tickets can be updated.", StatusCodes.BAD_REQUEST);
  }

  const { data: updated, error: updateError } = await supabase
    .from("tickets")
    .update({ concern })
    .eq("id", id)
    .select(TICKET_SELECT_PROJECTION)
    .single();

  if (updateError) {
    throw new ServiceError(updateError.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  return NextResponse.json({
    data: updated,
    message: "Ticket updated successfully.",
  });
});

export const DELETE = handleApiRoute(async (request: Request, context: ApiContext) => {
  const validation = deleteTicketSchema.safeParse(await request.json());

  if (!validation.success) {
    return validationErrorResponse(validation.error);
  }

  const { id } = validation.data;
  const ticket = await findTicketForFactory(id, context.factory.id);

  if (ticket.status !== "pending") {
    throw new ServiceError("Only pending tickets can be deleted.", StatusCodes.BAD_REQUEST);
  }

  const { error: deleteError } = await supabase.from("tickets").delete().eq("id", id);

  if (deleteError) {
    if (deleteError.code === "23503") {
      throw new ServiceError(
        "Cannot delete ticket due to dependent records.",
        StatusCodes.CONFLICT,
      );
    }
    throw new ServiceError(deleteError.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  return NextResponse.json({
    success: true,
    message: "Ticket deleted successfully.",
  });
});
