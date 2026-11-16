/**
 * @file app/api/data/entries/route.ts
 * @description External integration endpoint for factories to retrieve raw entries and acknowledge processed records.
 * Authenticated via the 'x-api-key' request header.
 */

import { type NextRequest } from "next/server";
import { handleDataOptions, handleDataGet, handleDataPost } from "../common";

export async function OPTIONS() {
  return handleDataOptions();
}

export async function GET(req: NextRequest) {
  return handleDataGet(req, {
    entityLabel: "entry",
    rpcName: "get_factory_entry_data",
  });
}

export async function POST(req: NextRequest) {
  return handleDataPost(req, {
    entityLabel: "entry",
    rpcName: "acknowledge_factory_entry",
    paramName: "p_entry_id",
  });
}
