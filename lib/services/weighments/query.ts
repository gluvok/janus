/**
 * @file lib/services/weighments/query.ts
 * @description Advanced query builder and filter pre-query coordinator for weighments list API.
 */

import { supabase } from "@/db";
import { Role } from "@/lib/constants/enums";
import { type AuthUserPayload } from "@/types";

export interface WeighmentQueryParams {
  searchParams: URLSearchParams;
  user: AuthUserPayload;
  pagination: { page: number; limit: number; offset: number };
}

export interface WeighmentQueryResult {
  data: Record<string, unknown>[] | null;
  count: number | null;
  error: { message: string } | null;
  emptyResult?: boolean;
}

export async function fetchWeighmentsList(
  client: typeof supabase,
  { searchParams, user, pagination }: WeighmentQueryParams,
): Promise<WeighmentQueryResult> {
  const search = searchParams.get("search");
  const sortColumn = searchParams.get("sort_column") || "created_at";
  const sortDesc = searchParams.get("sort_desc") !== "false";
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const typeParam = searchParams.get("type");
  const unitParam = searchParams.get("unit");
  const rateIdParam = searchParams.get("rate_id");

  const dualFilters = ["center_id", "user_id", "customer_id"] as const;
  const specificFilters: [string, "in_entry_id" | "out_entry_id", string][] = [
    ["in_user_id", "in_entry_id", "created_by"],
    ["in_customer_id", "in_entry_id", "customer_id"],
    ["out_user_id", "out_entry_id", "created_by"],
    ["out_customer_id", "out_entry_id", "customer_id"],
    ["in_center_id", "in_entry_id", "center_id"],
    ["out_center_id", "out_entry_id", "center_id"],
  ];

  type DualFilterResult = { type: "dual"; ids: number[] };
  type SpecificFilterResult = {
    type: "specific";
    targetCol: "in_entry_id" | "out_entry_id";
    ids: number[];
  };
  type SearchFilterResult = { type: "search"; searchNum: number; ids: number[] };
  type BaseScopeResult = { type: "base"; ids: number[] };

  const preQueryPromises: Promise<
    DualFilterResult | SpecificFilterResult | SearchFilterResult | BaseScopeResult
  >[] = [];

  if (user.role === Role.BASE) {
    const userId = parseInt(user.sub, 10);
    preQueryPromises.push(
      (async (): Promise<BaseScopeResult> => {
        const { data } = await client
          .from("entries")
          .select("id, centers!inner(factory_id), customers!inner(user_id)")
          .eq("centers.factory_id", user.factory_id!)
          .eq("customers.user_id", userId)
          .is("deleted_at", null);
        return {
          type: "base",
          ids: (data || []).map((e: { id: number }) => e.id),
        };
      })(),
    );
  }

  for (const key of dualFilters) {
    const val = searchParams.get(key);
    if (val && val !== "all") {
      const id = Number(val);
      if (!isNaN(id)) {
        preQueryPromises.push(
          (async (): Promise<DualFilterResult> => {
            let entryQuery = client
              .from("entries")
              .select("id, centers!inner(factory_id)")
              .eq("centers.factory_id", user.factory_id!)
              .is("deleted_at", null);
            if (key === "user_id") {
              entryQuery = entryQuery.or(`created_by.eq.${id},approved_by.eq.${id}`);
            } else {
              entryQuery = entryQuery.eq(key, id);
            }
            const { data } = await entryQuery;
            return {
              type: "dual",
              ids: (data || []).map((e: { id: number }) => e.id),
            };
          })(),
        );
      }
    }
  }

  for (const [param, targetCol, entryCol] of specificFilters) {
    const val = searchParams.get(param);
    if (val && val !== "all") {
      const id = Number(val);
      if (!isNaN(id)) {
        preQueryPromises.push(
          (async (): Promise<SpecificFilterResult> => {
            const { data } = await client
              .from("entries")
              .select("id, centers!inner(factory_id)")
              .eq("centers.factory_id", user.factory_id!)
              .eq(entryCol, id)
              .is("deleted_at", null);
            return {
              type: "specific",
              targetCol,
              ids: (data || []).map((e: { id: number }) => e.id),
            };
          })(),
        );
      }
    }
  }

  if (search) {
    const searchNum = parseInt(search, 10);
    preQueryPromises.push(
      (async (): Promise<SearchFilterResult> => {
        const { data } = await client
          .from("entries")
          .select("id, centers!inner(factory_id)")
          .eq("centers.factory_id", user.factory_id!)
          .ilike("vehicle_number", `%${search}%`)
          .is("deleted_at", null);
        return {
          type: "search",
          searchNum,
          ids: (data || []).map((e: { id: number }) => e.id),
        };
      })(),
    );
  }

  const preQueryResults = await Promise.all(preQueryPromises);

  let query = client
    .from("weighments")
    .select(
      `*, in_entry:entries!in_entry_id!inner(id, weight, images, created_at, center_id, created_by, approved_by, customer_id, vehicle_number, centers!inner(name, factory_id), users:users!created_by(name), customers(name)), out_entry:entries!out_entry_id(id, weight, images, created_at, center_id, created_by, approved_by, customer_id, vehicle_number, centers(name), users:users!created_by(name), customers(name))`,
      { count: "exact" },
    )
    .eq("in_entry.centers.factory_id", user.factory_id!)
    .is("deleted_at", null);

  if (typeParam && typeParam !== "all") {
    query = query.eq("type", typeParam);
  }
  if (unitParam && unitParam !== "all") {
    query = query.eq("unit", unitParam);
  }
  if (rateIdParam && rateIdParam !== "all") {
    const rateId = Number(rateIdParam);
    if (!isNaN(rateId)) query = query.eq("rate_id", rateId);
  }
  if (startDate) query = query.gte("created_at", startDate);
  if (endDate) query = query.lte("created_at", endDate);

  for (const res of preQueryResults) {
    if (res.type === "base" || res.type === "dual") {
      if (res.ids.length === 0) {
        return { data: [], count: 0, error: null, emptyResult: true };
      }
      query = query.or(
        `in_entry_id.in.(${res.ids.join(",")}),out_entry_id.in.(${res.ids.join(",")})`,
      );
    } else if (res.type === "specific") {
      if (res.ids.length === 0) {
        return { data: [], count: 0, error: null, emptyResult: true };
      }
      query = query.in(res.targetCol, res.ids);
    } else if (res.type === "search") {
      const searchClauses: string[] = [];
      if (!isNaN(res.searchNum)) {
        searchClauses.push(
          `id.eq.${res.searchNum}`,
          `in_entry_id.eq.${res.searchNum}`,
          `out_entry_id.eq.${res.searchNum}`,
        );
      }
      if (res.ids.length > 0) {
        searchClauses.push(
          `in_entry_id.in.(${res.ids.join(",")})`,
          `out_entry_id.in.(${res.ids.join(",")})`,
        );
      }
      if (searchClauses.length > 0) {
        query = query.or(searchClauses.join(","));
      } else {
        return { data: [], count: 0, error: null, emptyResult: true };
      }
    }
  }

  const effectiveSortColumn =
    sortColumn === "vehicle_number"
      ? "in_entry.vehicle_number"
      : sortColumn.startsWith("in_entry_")
        ? `in_entry.${sortColumn.replace(/^in_entry_/, "")}`
        : sortColumn.startsWith("out_entry_")
          ? `out_entry.${sortColumn.replace(/^out_entry_/, "")}`
          : sortColumn;

  query = query.order(effectiveSortColumn, { ascending: !sortDesc });

  const { offset, limit } = pagination;
  const { data, count, error } = await query.range(offset, offset + limit - 1);

  return { data, count, error };
}
