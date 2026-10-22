/**
 * @file app/api/tickets/route.ts
 * @description API route for listing and creating support tickets.
 */

import { NextResponse } from "next/server";
import {
  withAuth,
  getPaginationParams,
  apiError,
  forbiddenError,
  hasPermission,
  StatusCodes,
  fetchPaginatedResult,
} from "@/db/helpers";
import { PermissionKey, ProjectSlug, TicketStatus } from "@/lib/constants/enums";
import { createTicketSchema } from "@/lib/validation/tickets";

export const GET = withAuth(async (req, user, client) => {
  if (!hasPermission(user, ProjectSlug.TICKETS, PermissionKey.READ)) {
    return forbiddenError();
  }

  const pagination = getPaginationParams(req.nextUrl);
  const search = req.nextUrl.searchParams.get("search");
  const status = req.nextUrl.searchParams.get("status");
  const userIdFilter = req.nextUrl.searchParams.get("user_id");
  const sortColumn = req.nextUrl.searchParams.get("sort_column") || "created_at";
  const sortDesc = req.nextUrl.searchParams.has("sort_desc")
    ? req.nextUrl.searchParams.get("sort_desc") === "true"
    : true;

  let query = client
    .from("tickets")
    .select(
      `
      id,
      concern,
      reply,
      status,
      entry_id,
      weighment_id,
      user_id,
      created_at,
      updated_at,
      users!inner(id, name, username, factory_id),
      entries!left(id, vehicle_number, weight, status, created_at),
      weighments!left(id, unit, gross_weight, tare_weight, net_weight, created_at, in_entry:in_entry_id(vehicle_number))
    `,
      { count: "exact" },
    )
    .eq("users.factory_id", user.factory_id!)
    .is("deleted_at", null)
    .order(sortColumn, { ascending: !sortDesc });

  if (
    status &&
    (status === TicketStatus.PENDING ||
      status === TicketStatus.APPROVED ||
      status === TicketStatus.REJECTED)
  ) {
    query = query.eq("status", status);
  }

  if (userIdFilter) {
    const parsedUserId = parseInt(userIdFilter, 10);
    if (!isNaN(parsedUserId)) {
      query = query.eq("user_id", parsedUserId);
    }
  }

  if (search) {
    const searchNum = parseInt(search, 10);
    if (!isNaN(searchNum)) {
      query = query.or(
        `concern.ilike.%${search}%,reply.ilike.%${search}%,id.eq.${searchNum},entry_id.eq.${searchNum},weighment_id.eq.${searchNum}`,
      );
    } else {
      query = query.or(`concern.ilike.%${search}%,reply.ilike.%${search}%`);
    }
  }

  return fetchPaginatedResult(query, pagination);
});

export const POST = withAuth(async (req, user, client) => {
  if (!hasPermission(user, ProjectSlug.TICKETS, PermissionKey.CREATE)) {
    return forbiddenError();
  }

  const body = await req.json();
  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, StatusCodes.BAD_REQUEST);
  }

  const { entry_id, weighment_id, concern } = parsed.data;

  // Validate the linked entry or weighment exists within the user's factory
  if (entry_id) {
    const { data: entry, error: entryError } = await client
      .from("entries")
      .select("id, centers!inner(factory_id)")
      .eq("id", entry_id)
      .eq("centers.factory_id", user.factory_id!)
      .is("deleted_at", null)
      .maybeSingle();

    if (entryError || !entry) {
      return apiError("Linked entry not found in your factory", StatusCodes.NOT_FOUND);
    }
  } else if (weighment_id) {
    const { data: weighment, error: weighmentError } = await client
      .from("weighments")
      .select("id, in_entry:entries!in_entry_id!inner(centers!inner(factory_id))")
      .eq("id", weighment_id)
      .is("deleted_at", null)
      .maybeSingle();

    const inEntry = weighment?.in_entry as { centers?: { factory_id?: number } } | undefined;
    if (weighmentError || !weighment || inEntry?.centers?.factory_id !== user.factory_id) {
      return apiError("Linked weighment not found in your factory", StatusCodes.NOT_FOUND);
    }
  }

  const userId = parseInt(user.sub, 10);

  const { data: inserted, error: insertError } = await client
    .from("tickets")
    .insert({
      entry_id: entry_id ?? null,
      weighment_id: weighment_id ?? null,
      concern,
      status: TicketStatus.PENDING,
      user_id: userId,
    })
    .select(
      `
      id,
      concern,
      reply,
      status,
      entry_id,
      weighment_id,
      user_id,
      created_at,
      updated_at,
      users(id, name, username),
      entries(id, vehicle_number, weight, status),
      weighments(id, unit, gross_weight, tare_weight, net_weight)
    `,
    )
    .single();

  if (insertError || !inserted) {
    return apiError("Failed to create support ticket", StatusCodes.INTERNAL_SERVER_ERROR);
  }

  return NextResponse.json({ data: inserted }, { status: StatusCodes.CREATED });
});
