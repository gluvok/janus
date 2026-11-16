/**
 * @file app/api/data/route.ts
 * @description External integration endpoint for factories to retrieve flattened weighments and acknowledge processed records.
 * Authenticated via the 'x-api-key' request header.
 */

import { type NextRequest, NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/db";
import { type DataApiWeighmentItem } from "@/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

function getApiKey(req: NextRequest): string | null {
  const key = req.headers.get("x-api-key");
  return key && key.trim() ? key.trim() : null;
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing x-api-key header" },
      { status: StatusCodes.UNAUTHORIZED, headers: CORS_HEADERS },
    );
  }

  // Execute atomic PostgreSQL RPC function for authentication and retrieval of unprocessed weighments
  const { data: rpcResult, error: rpcError } = await supabase.rpc("get_factory_weighment_data", {
    p_api_key: apiKey,
  });

  if (rpcError) {
    console.error("RPC get_factory_weighment_data error:", rpcError);
    return NextResponse.json(
      { error: "Failed to retrieve weighment data" },
      { status: StatusCodes.INTERNAL_SERVER_ERROR, headers: CORS_HEADERS },
    );
  }

  if (!rpcResult || (rpcResult as { unauthorized?: boolean }).unauthorized) {
    return NextResponse.json(
      { error: "Invalid API key" },
      { status: StatusCodes.UNAUTHORIZED, headers: CORS_HEADERS },
    );
  }

  const result = rpcResult as {
    data: DataApiWeighmentItem[];
    count: number;
  };

  return NextResponse.json(
    {
      data: result.data || [],
      count: result.count,
    },
    { status: StatusCodes.OK, headers: CORS_HEADERS },
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing x-api-key header" },
      { status: StatusCodes.UNAUTHORIZED, headers: CORS_HEADERS },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: StatusCodes.BAD_REQUEST, headers: CORS_HEADERS },
    );
  }

  const rawId =
    (body as { weighment_id?: unknown; id?: unknown })?.weighment_id ??
    (body as { weighment_id?: unknown; id?: unknown })?.id;

  let weighmentId: number | null = null;
  if (typeof rawId === "number" && Number.isSafeInteger(rawId) && rawId > 0) {
    weighmentId = rawId;
  } else if (typeof rawId === "string" && /^\d+$/.test(rawId.trim())) {
    const parsed = parseInt(rawId.trim(), 10);
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      weighmentId = parsed;
    }
  }

  if (!weighmentId) {
    return NextResponse.json(
      { error: "Invalid or missing weighment ID" },
      { status: StatusCodes.BAD_REQUEST, headers: CORS_HEADERS },
    );
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc("acknowledge_factory_weighment", {
    p_api_key: apiKey,
    p_weighment_id: weighmentId,
  });

  if (rpcError) {
    console.error("RPC acknowledge_factory_weighment error:", rpcError);
    return NextResponse.json(
      { error: "Failed to acknowledge weighment" },
      { status: StatusCodes.INTERNAL_SERVER_ERROR, headers: CORS_HEADERS },
    );
  }

  const resObj = rpcResult as {
    unauthorized?: boolean;
    not_found?: boolean;
    success?: boolean;
    acknowledged_id?: number;
  } | null;

  if (!resObj || resObj.unauthorized) {
    return NextResponse.json(
      { error: "Invalid API key" },
      { status: StatusCodes.UNAUTHORIZED, headers: CORS_HEADERS },
    );
  }

  if (resObj.not_found) {
    return NextResponse.json(
      { error: "Weighment not found" },
      { status: StatusCodes.NOT_FOUND, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(
    {
      success: true,
      acknowledged_id: weighmentId,
      message: "Weighment acknowledged successfully",
    },
    { status: StatusCodes.OK, headers: CORS_HEADERS },
  );
}
