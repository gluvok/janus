import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { executePaginatedEntityQuery } from "@/lib/api-query";
import { updateCenterSchema, type Center } from "@/app/centers/types";
import { getAuthUser } from "@/lib/auth";
import { handleApiRoute } from "@/lib/api-handler";

const ALLOWED_SORT_COLUMNS = ["id", "name", "created_at", "updated_at"] as const;

export const GET = handleApiRoute(async (request: Request) => {
  const user = getAuthUser(request);

  return executePaginatedEntityQuery<(typeof ALLOWED_SORT_COLUMNS)[number], Center>({
    request,
    table: "centers",
    select: "id, name, factory_id, api_key, created_at, updated_at",
    allowedSortColumns: ALLOWED_SORT_COLUMNS,
    defaultSort: { col: "name", ascending: true },
    searchColumns: ["name"],
    applyCustomFilters: (query) => {
      return query.eq("factory_id", user.factory_id);
    },
  });
});

export const PATCH = handleApiRoute(async (request: Request) => {
  getAuthUser(request);
  const validation = updateCenterSchema.safeParse(await request.json());

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const { id, name } = validation.data;

  const { data, error } = await supabase
    .from("centers")
    .update({ name })
    .eq("id", id)
    .select("id, name, factory_id, api_key, created_at, updated_at")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `Center with name "${name}" already exists in this factory.` },
        { status: StatusCodes.CONFLICT },
      );
    }
    return NextResponse.json(
      { error: error.message },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Center not found or has been deleted." },
      { status: StatusCodes.NOT_FOUND },
    );
  }

  return NextResponse.json({
    center: data,
    message: `Center "${name}" updated successfully.`,
  });
});
