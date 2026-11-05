import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { updateFactorySchema } from "@/app/settings/types";
import { requireServerSession, AuthError } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireServerSession(request);

    const { data, error } = await supabase
      .from("factories")
      .select("id, name, receipt_images_per_row, created_at, updated_at")
      .eq("id", user.factory_id)
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
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireServerSession(request);
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
      .eq("id", user.factory_id)
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
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
