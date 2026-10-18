import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import {
  parsePagination,
  parseSorting,
  applyDateRange,
  applySortingAndPagination,
  formatPaginatedResponse,
} from "@/lib/api-query";
import {
  parseNumericWeight,
  commaSeparatedIdsSchema,
  applyCommonEntriesFilters,
  sortEntriesRelational,
  paginateInMemory,
} from "@/lib/entries-query";
import { type ManualEntry } from "@/app/entries/types";

const ALLOWED_SORT_COLUMNS = [
  "id",
  "vehicle_number",
  "weight",
  "center",
  "customer",
  "created_by",
  "created_at",
  "updated_at",
] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const pagination = parsePagination(searchParams);
    const sortRules = parseSorting(searchParams, ALLOWED_SORT_COLUMNS, {
      col: "id",
      ascending: false,
    });

    let query = supabase
      .from("manual_entries")
      .select(
        `
          id,
          center_id,
          customer_id,
          created_by,
          vehicle_number,
          weight,
          images,
          created_at,
          updated_at,
          center:centers(id, name),
          customer:users!manual_entries_customer_id_fkey(id, name),
          created_by_user:users!manual_entries_created_by_fkey(id, name, role)
        `,
        { count: "exact" },
      )
      .is("deleted_at", null);

    const search = searchParams.get("search")?.trim();
    if (search) {
      const numericVal = parseNumericWeight(search);
      if (numericVal !== null) {
        query = query.or(`vehicle_number.ilike.%${search}%,weight.eq.${numericVal}`);
      } else {
        query = query.ilike("vehicle_number", `%${search}%`);
      }
    }

    query = applyCommonEntriesFilters(query, searchParams);

    const createdBy = searchParams.get("created_by")?.trim();
    if (createdBy && createdBy !== "all") {
      const parsed = commaSeparatedIdsSchema.safeParse(createdBy);
      if (parsed.success && parsed.data.length > 0) {
        query = query.in("created_by", parsed.data);
      }
    }

    query = applyDateRange(query, searchParams);

    const hasRelationalSort = sortRules.some((r) =>
      ["center", "customer", "created_by"].includes(r.col),
    );

    if (hasRelationalSort) {
      const { data, count, error } = await query;
      if (error) throw error;

      const sorted = sortEntriesRelational((data ?? []) as unknown as ManualEntry[], sortRules);
      const sliced = paginateInMemory(sorted, pagination);

      return NextResponse.json(formatPaginatedResponse(sliced, count, pagination), {
        status: StatusCodes.OK,
      });
    }

    query = applySortingAndPagination(query, sortRules, pagination);
    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json(
      formatPaginatedResponse((data ?? []) as unknown as ManualEntry[], count, pagination),
      { status: StatusCodes.OK },
    );
  } catch (error) {
    console.error("GET /api/entries/manual error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }
}
