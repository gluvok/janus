import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { executePaginatedEntityQuery } from "@/lib/api-query";
import { updateCenterSchema } from "@/app/centers/types";

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
    const existing = await db
      .select({ id: schema.centers.id })
      .from(schema.centers)
      .where(and(eq(schema.centers.name, name), ne(schema.centers.id, id)))
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      return NextResponse.json(
        { error: `Center with name "${name}" already exists.` },
        { status: StatusCodes.CONFLICT },
      );
    }

    const [updated] = await db
      .update(schema.centers)
      .set({ name, updated_at: new Date().toISOString() })
      .where(eq(schema.centers.id, id))
      .returning({
        id: schema.centers.id,
        name: schema.centers.name,
        created_at: schema.centers.created_at,
        updated_at: schema.centers.updated_at,
      });

    if (!updated) {
      return NextResponse.json(
        { error: "Center not found or failed to update center" },
        { status: StatusCodes.NOT_FOUND },
      );
    }

    return NextResponse.json({
      center: updated,
      message: `Center "${name}" updated successfully.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
