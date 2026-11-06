import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { executePaginatedEntityQuery } from "@/lib/api-query";
import { handleApiRoute, type ApiContext } from "@/lib/api-handler";
import {
  ticketStatusEnum,
  updateTicketSchema,
  deleteTicketSchema,
  TICKET_SELECT_PROJECTION,
  type Ticket,
  type TicketStatus,
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

export const GET = handleApiRoute(async (request: Request) => {
  return executePaginatedEntityQuery<(typeof ALLOWED_SORT_COLUMNS)[number], Ticket>({
    request,
    table: "tickets",
    select: TICKET_SELECT_PROJECTION,
    allowedSortColumns: ALLOWED_SORT_COLUMNS,
    defaultSort: { col: "created_at", ascending: false },
    searchColumns: ["concern", "reply"],
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
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const { id, reply, status } = validation.data;

  const { data: existing, error: findError } = await supabase
    .from("tickets")
    .select("id, status, user:users!user_id!inner(factory_id)")
    .eq("id", id)
    .eq("user.factory_id", context.factory.id)
    .maybeSingle();

  if (findError) {
    return NextResponse.json(
      { error: findError.message },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }

  if (!existing) {
    return NextResponse.json(
      { error: "Ticket not found or has been deleted." },
      { status: StatusCodes.NOT_FOUND },
    );
  }

  const updates: { reply?: string | null; status?: TicketStatus } = {};
  if (reply !== undefined) {
    updates.reply = reply;
  }
  if (status !== undefined) {
    updates.status = status;
  }

  const { data: updated, error: updateError } = await supabase
    .from("tickets")
    .update(updates)
    .eq("id", id)
    .select(TICKET_SELECT_PROJECTION)
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }

  return NextResponse.json({
    data: updated,
    message: "Ticket updated successfully.",
  });
});

export const DELETE = handleApiRoute(async (request: Request, context: ApiContext) => {
  const validation = deleteTicketSchema.safeParse(await request.json());

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const { id } = validation.data;

  const { data: ticket, error: findError } = await supabase
    .from("tickets")
    .select("id, status, user:users!user_id!inner(factory_id)")
    .eq("id", id)
    .eq("user.factory_id", context.factory.id)
    .maybeSingle();

  if (findError) {
    return NextResponse.json(
      { error: findError.message },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }

  if (!ticket) {
    return NextResponse.json(
      { error: "Ticket not found or has been deleted." },
      { status: StatusCodes.NOT_FOUND },
    );
  }

  if (ticket.status !== "pending") {
    return NextResponse.json(
      { error: "Only pending tickets can be deleted." },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const { error: deleteError } = await supabase.from("tickets").delete().eq("id", id);

  if (deleteError) {
    if (deleteError.code === "23503") {
      return NextResponse.json(
        { error: "Cannot delete ticket due to dependent records." },
        { status: StatusCodes.CONFLICT },
      );
    }
    return NextResponse.json(
      { error: deleteError.message },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Ticket deleted successfully.",
  });
});
