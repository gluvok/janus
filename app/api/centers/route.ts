import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { executePaginatedEntityQuery } from "@/lib/api-query";
import { updateCenterSchema, type Center } from "@/app/centers/types";
import { requireServerSession, AuthError } from "@/lib/auth";

const ALLOWED_SORT_COLUMNS = ["id", "name", "created_at", "updated_at"] as const;

export async function GET(request: Request) {
  try {
    const user = await requireServerSession(request);

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
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireServerSession(request);
    const validation = updateCenterSchema.safeParse(await request.json());

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Invalid input" },
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
        { error: error.message ?? "Failed to update center" },
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
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
