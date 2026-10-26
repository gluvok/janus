/**
 * @file app/api/data/route.ts
 * @description External integration endpoint for factories to retrieve their weighments and linked entries.
 * Authenticated via the 'x-api-key' request header.
 */

import { type NextRequest, NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/db";
import { formatWeighmentRecord } from "@/lib/services/weighments";
import { type DataApiWeighmentItem } from "@/types";

function formatEntryObject(
  entry: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!entry) return null;

  const centerName = (entry.centers as { name?: string } | undefined)?.name ?? "";
  const userName = (entry.users as { name?: string } | undefined)?.name ?? "";
  const customerName = (entry.customers as { name?: string } | undefined)?.name ?? "";

  return {
    id: entry.id,
    vehicle_number: entry.vehicle_number,
    detected_vehicle_number: entry.detected_vehicle_number,
    weight: Number(entry.weight),
    status: entry.status,
    auto_approved: entry.auto_approved,
    center_id: entry.center_id,
    center_name: centerName,
    customer_id: entry.customer_id,
    customer_name: customerName,
    created_by: entry.created_by,
    created_by_name: userName,
    approved_by: entry.approved_by,
    images: Array.isArray(entry.images) ? entry.images : [],
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
}

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
  if (rawProcessedId && rawProcessedId.trim() !== "") {
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
      id, weight, images, created_at, updated_at, center_id, created_by, approved_by, customer_id, vehicle_number, detected_vehicle_number, status, auto_approved,
      centers!inner(name, factory_id),
      users:users!created_by(name),
      customers(name)
    ),
    out_entry:entries!out_entry_id(
      id, weight, images, created_at, updated_at, center_id, created_by, approved_by, customer_id, vehicle_number, detected_vehicle_number, status, auto_approved,
      centers(name),
      users:users!created_by(name),
      customers(name)
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

  // 4. Format payload: flattened weighment summary + embedded in_entry and out_entry records
  const rawRows = (rows as unknown as Record<string, unknown>[] | null) || [];
  const formattedData: DataApiWeighmentItem[] = rawRows.map((row: Record<string, unknown>) => {
    const flattened = formatWeighmentRecord(row);
    const inEntry = formatEntryObject(row.in_entry as Record<string, unknown> | null);
    const outEntry = formatEntryObject(row.out_entry as Record<string, unknown> | null);

    return {
      ...(flattened as unknown as Omit<DataApiWeighmentItem, "in_entry" | "out_entry">),
      in_entry: inEntry || {},
      out_entry: outEntry || {},
    };
  });

  return NextResponse.json(
    {
      data: formattedData,
      factory: {
        id: factory.id,
        name: factory.name,
      },
      count: formattedData.length,
    },
    { status: StatusCodes.OK },
  );
}
