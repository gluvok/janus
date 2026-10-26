/**
 * @file app/api/data/route.ts
 * @description External integration endpoint for factories to retrieve flattened weighments.
 * Authenticated via the 'x-api-key' request header, with stateful processed ID exclusion.
 */

import { type NextRequest, NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/db";
import { type DataApiWeighmentItem } from "@/types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey.trim() === "") {
    return NextResponse.json(
      { error: "Missing x-api-key header" },
      { status: StatusCodes.UNAUTHORIZED },
    );
  }

  // 1. Look up active factory by API key
  const { data: factory, error: factoryError } = await supabase
    .from("factories")
    .select("id, name")
    .eq("api_key", apiKey.trim())
    .is("deleted_at", null)
    .maybeSingle();

  if (factoryError) {
    console.error("Factory API key lookup error:", factoryError);
    return NextResponse.json(
      { error: "Database error during authentication" },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }

  if (!factory) {
    return NextResponse.json({ error: "Invalid API key" }, { status: StatusCodes.UNAUTHORIZED });
  }

  // 2. If x-processed-id header is provided, record it for this factory
  const rawProcessedId = req.headers.get("x-processed-id");
  if (rawProcessedId) {
    const processedId = parseInt(rawProcessedId.trim(), 10);
    if (Number.isSafeInteger(processedId) && processedId > 0) {
      const { error: upsertErr } = await supabase
        .from("factory_processed_weighments")
        .upsert(
          { factory_id: factory.id, weighment_id: processedId },
          { onConflict: "factory_id,weighment_id", ignoreDuplicates: true },
        );
      if (upsertErr) {
        console.error("Error recording processed weighment ID:", upsertErr);
      }
    }
  }

  // 3. Fetch all previously recorded processed IDs for this factory
  const { data: processedRows, error: processedErr } = await supabase
    .from("factory_processed_weighments")
    .select("weighment_id")
    .eq("factory_id", factory.id);

  if (processedErr) {
    console.error("Error fetching processed weighments:", processedErr);
  }

  const processedIds = (processedRows || [])
    .map((r: { weighment_id: number }) => r.weighment_id)
    .filter((id): id is number => typeof id === "number" && id > 0);

  // 4. Query weighments joined with in_entry and out_entry for this factory
  const selectQuery = `
    *,
    in_entry:entries!in_entry_id!inner(
      id, weight, created_at, center_id, vehicle_number,
      centers!inner(name, factory_id)
    ),
    out_entry:entries!out_entry_id(
      id, weight, created_at, center_id, vehicle_number,
      centers(name)
    )
  `
    .replace(/\s+/g, " ")
    .trim();

  let query = supabase
    .from("weighments")
    .select(selectQuery)
    .eq("in_entry.centers.factory_id", factory.id)
    .is("deleted_at", null);

  if (processedIds.length > 0) {
    query = query.not("id", "in", `(${processedIds.join(",")})`);
  }

  const { data: rows, error: queryError } = await query.order("created_at", {
    ascending: false,
  });

  if (queryError) {
    console.error("Weighments data query error:", queryError);
    return NextResponse.json(
      { error: "Failed to retrieve weighment data" },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }

  // 5. Format payload: pure flattened weighment records
  const rawRows = (rows as unknown as Record<string, unknown>[] | null) || [];
  const formattedData: DataApiWeighmentItem[] = rawRows.map((row: Record<string, unknown>) => {
    const inEntry = (row["in_entry"] as Record<string, unknown>) || {};
    const outEntry = (row["out_entry"] as Record<string, unknown>) || {};

    const inWeight = Number(inEntry.weight || 0);
    const outWeight = Number(outEntry.weight || 0);

    const grossWeight = Math.max(inWeight, outWeight);
    const tareWeight = Math.min(inWeight, outWeight);
    const netWeight = grossWeight - tareWeight;

    return {
      id: Number(row.id),
      vehicle_number: String(inEntry.vehicle_number || outEntry.vehicle_number || ""),
      gross_weight: grossWeight,
      tare_weight: tareWeight,
      net_weight: netWeight,
      in_entry_id: Number(row.in_entry_id),
      in_entry_time: String(inEntry.created_at || ""),
      out_entry_id: Number(row.out_entry_id),
      out_entry_time: String(outEntry.created_at || ""),
      in_center_id: (inEntry.center_id as number | undefined) ?? null,
      in_center_name: (inEntry.centers as { name?: string } | undefined)?.name ?? "",
      out_center_id: (outEntry.center_id as number | undefined) ?? null,
      out_center_name: (outEntry.centers as { name?: string } | undefined)?.name ?? "",
    };
  });

  return NextResponse.json(
    {
      data: formattedData,
      count: formattedData.length,
    },
    { status: StatusCodes.OK },
  );
}
