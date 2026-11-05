import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import crypto from "node:crypto";
import { supabase } from "@/lib/supabase";
import { executePaginatedEntityQuery } from "@/lib/api-query";
import { createCenterSchema, updateCenterSchema } from "@/app/centers/types";

const ALLOWED_SORT_COLUMNS = ["id", "name", "created_at", "updated_at"] as const;

export async function GET(request: Request) {
  return executePaginatedEntityQuery({
    request,
    table: "centers",
    select: "id, name, created_at, updated_at",
    allowedSortColumns: ALLOWED_SORT_COLUMNS,
    defaultSort: { col: "name", ascending: true },
    searchColumns: ["name"],
  });
}

export async function POST(request: Request) {
  try {
    const validation = createCenterSchema.safeParse(await request.json());

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Invalid input" },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const { name, factory_id = 1 } = validation.data;

    // Check for duplicate name among centers in the same factory
    const { data: existing } = await supabase
      .from("centers")
      .select("id")
      .eq("factory_id", factory_id)
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `Center with name "${name}" already exists.` },
        { status: StatusCodes.CONFLICT },
      );
    }

    const apiKey = crypto.randomBytes(16).toString("hex");

    const { data, error } = await supabase
      .from("centers")
      .insert({
        name,
        factory_id,
        api_key: apiKey,
      })
      .select("id, name, factory_id, api_key, created_at, updated_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create center" },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    return NextResponse.json(
      {
        center: data,
        message: `Center "${name}" created successfully.`,
      },
      { status: StatusCodes.CREATED },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

export async function PATCH(request: Request) {
  try {
    const validation = updateCenterSchema.safeParse(await request.json());

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Invalid input" },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const { id, name } = validation.data;

    // Check for duplicate name among centers
    const { data: existing } = await supabase
      .from("centers")
      .select("id")
      .eq("name", name)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `Center with name "${name}" already exists.` },
        { status: StatusCodes.CONFLICT },
      );
    }

    const { data, error } = await supabase
      .from("centers")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, name, created_at, updated_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to update center" },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    return NextResponse.json({
      center: data,
      message: `Center "${name}" updated successfully.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
