import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { updateFactorySchema } from "@/app/settings/types";

/**
 * Hardcoded factory ID for single-tenant / current-tenant preview.
 * When session authentication is introduced, this will be retrieved from the user's session context.
 */
const HARDCODED_FACTORY_ID = 1;

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("factories")
      .select("id, name, receipt_images_per_row, created_at, updated_at")
      .eq("id", HARDCODED_FACTORY_ID)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Factory not found" }, { status: StatusCodes.NOT_FOUND });
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const parseResult = updateFactorySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid payload" },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const { data, error } = await supabase
      .from("factories")
      .update(parseResult.data)
      .eq("id", HARDCODED_FACTORY_ID)
      .select("id, name, receipt_images_per_row, created_at, updated_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Factory not found" }, { status: StatusCodes.NOT_FOUND });
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
