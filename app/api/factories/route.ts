import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { updateFactorySchema } from "@/app/settings/types";
import { getAuthUser } from "@/lib/auth";
import { handleApiRoute } from "@/lib/api-handler";

export const GET = handleApiRoute(async (request: Request) => {
  const user = getAuthUser(request);

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
});

export const PATCH = handleApiRoute(async (request: Request) => {
  const user = getAuthUser(request);
  const body = await request.json();

  const parseResult = updateFactorySchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0].message },
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
});
