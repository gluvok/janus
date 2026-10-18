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
  applyCommonEntriesFilters,
  sortEntriesRelational,
  paginateInMemory,
} from "@/lib/entries-query";
import { type AutomaticEntry } from "@/app/entries/types";

const ALLOWED_SORT_COLUMNS = [
  "id",
  "vehicle_number",
  "detected_vehicle_number",
  "weight",
  "center",
  "customer",
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
      .from("automatic_entries")
      .select(
        `
          id,
          device_id,
          center_id,
          customer_id,
          detected_vehicle_number,
          vehicle_number,
          weight,
          images,
          created_at,
          updated_at,
          center:centers(id, name),
          customer:users!automatic_entries_customer_id_fkey(id, name)
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
        query = query.or(`vehicle_number.ilike.%${search}%`);
      }
    }

    query = applyCommonEntriesFilters(query, searchParams);
    query = applyDateRange(query, searchParams);

    const hasRelationalSort = sortRules.some((r) => ["center", "customer"].includes(r.col));

    if (hasRelationalSort) {
      const { data, count, error } = await query;
      if (error) throw error;

      const sorted = sortEntriesRelational((data ?? []) as unknown as AutomaticEntry[], sortRules);
      const sliced = paginateInMemory(sorted, pagination);

      return NextResponse.json(formatPaginatedResponse(sliced, count, pagination), {
        status: StatusCodes.OK,
      });
    }

    query = applySortingAndPagination(query, sortRules, pagination);
    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json(
      formatPaginatedResponse((data ?? []) as unknown as AutomaticEntry[], count, pagination),
      { status: StatusCodes.OK },
    );
  } catch (error) {
    console.error("GET /api/entries/automatic error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }
}
