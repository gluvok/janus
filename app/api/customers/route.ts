import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import {
  parsePagination,
  parseSorting,
  applyDateRange,
  applySorting,
  applySortingAndPagination,
  formatPaginatedResponse,
} from "@/lib/api-query";
import {
  createCustomerSchema,
  updateCustomerSchema,
  deleteCustomersSchema,
} from "@/app/customers/types";

const ALLOWED_SORT_COLUMNS = ["id", "name", "created_at", "updated_at"] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isAll = searchParams.get("all") === "true";

    const pagination = parsePagination(searchParams);
    const sortRules = parseSorting(searchParams, ALLOWED_SORT_COLUMNS, {
      col: "name",
      ascending: true,
    });

    let query = supabase
      .from("customers")
      .select("id, name, factory_id, created_at, updated_at", { count: "exact" })
      .is("deleted_at", null);

    const search = searchParams.get("search")?.trim();
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    query = applyDateRange(query, searchParams);

    if (isAll) {
      query = applySorting(
        query,
        sortRules.length > 0 ? sortRules : [{ col: "name", ascending: true }],
      );
    } else {
      query = applySortingAndPagination(query, sortRules, pagination);
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    if (isAll) {
      return NextResponse.json({
        data: data ?? [],
        totalCount: data?.length ?? 0,
        page: 1,
        pageSize: data?.length ?? 0,
        totalPages: 1,
      });
    }

    return NextResponse.json(formatPaginatedResponse(data, count, pagination));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const validation = createCustomerSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Invalid input" },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const { name, factory_id } = validation.data;
    const targetFactoryId = factory_id ?? 1;

    // Check for duplicate active customer name in same factory
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("factory_id", targetFactoryId)
      .eq("name", name)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `Customer with name "${name}" already exists.` },
        { status: StatusCodes.CONFLICT },
      );
    }

    const { data, error } = await supabase
      .from("customers")
      .insert({
        name,
        factory_id: targetFactoryId,
      })
      .select("id, name, factory_id, created_at, updated_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create customer" },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    return NextResponse.json(
      { customer: data, message: `Customer "${name}" created successfully.` },
      { status: StatusCodes.CREATED },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

export async function PATCH(request: Request) {
  try {
    const rawBody = await request.json();
    const validation = updateCustomerSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Invalid input" },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const { id, name } = validation.data;

    // Check for duplicate name
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("name", name)
      .neq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `Customer with name "${name}" already exists.` },
        { status: StatusCodes.CONFLICT },
      );
    }

    const { data, error } = await supabase
      .from("customers")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, name, factory_id, created_at, updated_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to update customer" },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    return NextResponse.json({
      customer: data,
      message: `Customer "${name}" updated successfully.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

export async function DELETE(request: Request) {
  try {
    const rawBody = await request.json();
    const validation = deleteCustomersSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Invalid input" },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const { ids } = validation.data;

    // Bulk soft delete
    const { error } = await supabase
      .from("customers")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", ids);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${ids.length} customer${ids.length > 1 ? "s" : ""}.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
