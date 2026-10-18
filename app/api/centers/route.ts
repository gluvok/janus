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
      .from("centers")
      .select("id, name, created_at, updated_at", { count: "exact" })
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
