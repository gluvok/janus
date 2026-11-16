/**
 * @file app/api/data/common.ts
 * @description Common helpers and handlers for factory data integration endpoints.
 */

import { type NextRequest, NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/db";

export function getApiKey(req: NextRequest): string | null {
  return req.headers.get("x-api-key");
}

export function handleDataOptions(): NextResponse {
  return NextResponse.json({});
}

interface DataGetConfig {
  entityLabel: string;
  rpcName: "get_factory_weighment_data" | "get_factory_entry_data";
}

export async function handleDataGet(
  req: NextRequest,
  config: DataGetConfig,
): Promise<NextResponse> {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing x-api-key header" },
      { status: StatusCodes.UNAUTHORIZED },
    );
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc(config.rpcName, {
    p_api_key: apiKey,
  });

  if (rpcError) {
    console.error(`RPC ${config.rpcName} error:`, rpcError);
    return NextResponse.json(
      { error: `Failed to retrieve ${config.entityLabel} data` },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }

  if (!rpcResult || (rpcResult as { unauthorized?: boolean }).unauthorized) {
    return NextResponse.json({ error: "Invalid API key" }, { status: StatusCodes.UNAUTHORIZED });
  }

  const result = rpcResult as {
    data: unknown[];
    count: number;
  };

  return NextResponse.json(
    {
      data: result.data || [],
      count: result.count,
    },
    { status: StatusCodes.OK },
  );
}

interface DataPostConfig {
  entityLabel: string;
  rpcName: "acknowledge_factory_weighment" | "acknowledge_factory_entry";
  paramName: "p_weighment_id" | "p_entry_id";
}

export async function handleDataPost(
  req: NextRequest,
  config: DataPostConfig,
): Promise<NextResponse> {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing x-api-key header" },
      { status: StatusCodes.UNAUTHORIZED },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: StatusCodes.BAD_REQUEST });
  }

  const id = (body as { id?: unknown })?.id;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "Invalid or missing ID" },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc(config.rpcName, {
    p_api_key: apiKey,
    [config.paramName]: id,
  });

  if (rpcError) {
    console.error(`RPC ${config.rpcName} error:`, rpcError);
    return NextResponse.json(
      { error: `Failed to acknowledge ${config.entityLabel}` },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }

  const resObj = rpcResult as {
    unauthorized?: boolean;
    not_found?: boolean;
    success?: boolean;
    acknowledged_id?: number;
  } | null;

  if (!resObj || resObj.unauthorized) {
    return NextResponse.json({ error: "Invalid API key" }, { status: StatusCodes.UNAUTHORIZED });
  }

  if (resObj.not_found) {
    const capitalized = config.entityLabel.charAt(0).toUpperCase() + config.entityLabel.slice(1);
    return NextResponse.json(
      { error: `${capitalized} not found` },
      { status: StatusCodes.NOT_FOUND },
    );
  }

  const capitalized = config.entityLabel.charAt(0).toUpperCase() + config.entityLabel.slice(1);
  return NextResponse.json(
    {
      success: true,
      acknowledged_id: id,
      message: `${capitalized} acknowledged successfully`,
    },
    { status: StatusCodes.OK },
  );
}
