/**
 * @file app/api/data/weighments/route.ts
 * @description External integration endpoint for factories to retrieve flattened weighments and acknowledge processed records.
 * Authenticated via the 'x-api-key' request header.
 */

import { type NextRequest } from "next/server";
import { handleDataOptions, handleDataGet, handleDataPost } from "../common";

export async function OPTIONS() {
  return handleDataOptions();
}

export async function GET(req: NextRequest) {
  return handleDataGet(req, {
    entityLabel: "weighment",
    rpcName: "get_factory_weighment_data",
  });
}

export async function POST(req: NextRequest) {
  return handleDataPost(req, {
    entityLabel: "weighment",
    rpcName: "acknowledge_factory_weighment",
    paramName: "p_weighment_id",
  });
}
