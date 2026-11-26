import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { executePaginatedEntityQuery, executeAllEntityQuery } from "@/lib/api-query";
import { updateCenterSchema, type Center } from "@/app/centers/types";
import { handleApiRoute, ServiceError, type ApiContext } from "@/lib/api-handler";
import { ADMIN_MANAGER } from "@/lib/security";

const ALLOWED_SORT_COLUMNS = ["id", "name", "created_at", "updated_at"] as const;

export const GET = handleApiRoute(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const options = {
    request,
    table: "centers",
    select: "id, name, created_at, updated_at",
    allowedSortColumns: ALLOWED_SORT_COLUMNS,
    defaultSort: { col: "id" as const, ascending: false },
    searchColumns: ["name"],
    integerColumns: ["id"],
  };

  if (searchParams.get("all") === "true") {
    return executeAllEntityQuery<(typeof ALLOWED_SORT_COLUMNS)[number], Center>(options);
  }

  return executePaginatedEntityQuery<(typeof ALLOWED_SORT_COLUMNS)[number], Center>(options);
});

export const PATCH = handleApiRoute(
  async (request: Request, context: ApiContext) => {
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
      .eq("factory_id", context.factory.id)
      .select("id, name, created_at, updated_at")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: `Center with name "${name}" already exists in this factory.` },
          { status: StatusCodes.CONFLICT },
        );
      }
      console.error("Center save failed:", error);
      throw new ServiceError("Failed to save center.", StatusCodes.INTERNAL_SERVER_ERROR);
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
  },
  { roles: ADMIN_MANAGER },
);
