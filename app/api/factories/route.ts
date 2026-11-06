import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { updateFactorySchema } from "@/app/settings/types";
import { handleApiRoute, type ApiContext } from "@/lib/api-handler";
import { updateFactorySessionCache } from "@/lib/auth";

export const GET = handleApiRoute(async (_request: Request, context: ApiContext) => {
  const { data, error } = await supabase
    .from("factories")
    .select("id, name, receipt_images_per_row, created_at, updated_at")
    .eq("id", context.factory.id)
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

export const PATCH = handleApiRoute(async (request: Request, context: ApiContext) => {
  const parseResult = updateFactorySchema.safeParse(await request.json());
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0].message },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const { data, error } = await supabase
    .from("factories")
    .update(parseResult.data)
    .eq("id", context.factory.id)
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

  updateFactorySessionCache(context.factory.id, data);

  return NextResponse.json({ data });
});
