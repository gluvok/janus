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
  const rawApiKey = req.headers.get("x-api-key");
  const apiKey = rawApiKey ? rawApiKey.trim() : "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing x-api-key header" },
      { status: StatusCodes.UNAUTHORIZED },
    );
  }

  // Parse optional x-processed-id header
  const rawProcessedId = req.headers.get("x-processed-id");
  let processedId: number | null = null;
  if (rawProcessedId) {
    const parsed = parseInt(rawProcessedId.trim(), 10);
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      processedId = parsed;
    }
  }

  // Execute atomic PostgreSQL RPC function for authentication, acknowledgment, and retrieval
  const { data: rpcResult, error: rpcError } = await supabase.rpc("get_factory_weighment_data", {
    p_api_key: apiKey,
    p_processed_id: processedId,
  });

  if (rpcError) {
    console.error("RPC get_factory_weighment_data error:", rpcError);
    return NextResponse.json(
      { error: "Failed to retrieve weighment data" },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }

  if (!rpcResult || (rpcResult as { unauthorized?: boolean }).unauthorized) {
    return NextResponse.json({ error: "Invalid API key" }, { status: StatusCodes.UNAUTHORIZED });
  }

  const result = rpcResult as {
    data: DataApiWeighmentItem[];
    count: number;
  };

  return NextResponse.json(
    {
      data: result.data || [],
      count: result.count ?? (result.data ? result.data.length : 0),
    },
    { status: StatusCodes.OK },
  );
}
