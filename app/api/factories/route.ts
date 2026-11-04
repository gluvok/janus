import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { updateFactorySchema } from "@/app/settings/types";

/**
 * Hardcoded factory ID for single-tenant / current-tenant preview.
 * When session authentication is introduced, this will be retrieved from the user's session context.
 */
const HARDCODED_FACTORY_ID = 1;

export async function GET() {
  try {
    const factory = await db
      .select({
        id: schema.factories.id,
        name: schema.factories.name,
        receipt_images_per_row: schema.factories.receipt_images_per_row,
        created_at: schema.factories.created_at,
        updated_at: schema.factories.updated_at,
      })
      .from(schema.factories)
      .where(eq(schema.factories.id, HARDCODED_FACTORY_ID))
      .limit(1)
      .then((rows) => rows[0]);

    if (!factory) {
      return NextResponse.json({ error: "Factory not found" }, { status: StatusCodes.NOT_FOUND });
    }

    return NextResponse.json({ data: factory });
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

    const updates = {
      ...parseResult.data,
      updated_at: new Date().toISOString(),
    };

    const [updated] = await db
      .update(schema.factories)
      .set(updates)
      .where(eq(schema.factories.id, HARDCODED_FACTORY_ID))
      .returning({
        id: schema.factories.id,
        name: schema.factories.name,
        receipt_images_per_row: schema.factories.receipt_images_per_row,
        created_at: schema.factories.created_at,
        updated_at: schema.factories.updated_at,
      });

    if (!updated) {
      return NextResponse.json(
        { error: "Factory not found or failed to update factory" },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    return NextResponse.json({ data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
