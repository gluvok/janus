import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { and, eq, ne, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { executePaginatedEntityQuery } from "@/lib/api-query";
import {
  createCustomerSchema,
  updateCustomerSchema,
  deleteCustomersSchema,
} from "@/app/customers/types";

const ALLOWED_SORT_COLUMNS = ["id", "name", "created_at", "updated_at"] as const;

export async function GET(request: Request) {
  return executePaginatedEntityQuery({
    request,
    table: "customers",
    select: "id, name, factory_id, created_at, updated_at",
    allowedSortColumns: ALLOWED_SORT_COLUMNS,
    defaultSort: { col: "name", ascending: true },
    searchColumns: ["name"],
  });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const validation = createCustomerSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Invalid input" },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const { name, factory_id } = validation.data;
    const targetFactoryId = factory_id ?? 1;

    // Check for duplicate customer name in same factory
    const existing = await db
      .select({ id: schema.customers.id })
      .from(schema.customers)
      .where(and(eq(schema.customers.factory_id, targetFactoryId), eq(schema.customers.name, name)))
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      return NextResponse.json(
        { error: `Customer with name "${name}" already exists.` },
        { status: StatusCodes.CONFLICT },
      );
    }

    const [created] = await db
      .insert(schema.customers)
      .values({
        name,
        factory_id: targetFactoryId,
      })
      .returning({
        id: schema.customers.id,
        name: schema.customers.name,
        factory_id: schema.customers.factory_id,
        created_at: schema.customers.created_at,
        updated_at: schema.customers.updated_at,
      });

    return NextResponse.json(
      { customer: created, message: `Customer "${name}" created successfully.` },
      { status: StatusCodes.CREATED },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

export async function PATCH(request: Request) {
  try {
    const rawBody = await request.json();
    const validation = updateCustomerSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Invalid input" },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const { id, name } = validation.data;

    // Check for duplicate name
    const existing = await db
      .select({ id: schema.customers.id })
      .from(schema.customers)
      .where(and(eq(schema.customers.name, name), ne(schema.customers.id, id)))
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      return NextResponse.json(
        { error: `Customer with name "${name}" already exists.` },
        { status: StatusCodes.CONFLICT },
      );
    }

    const [updated] = await db
      .update(schema.customers)
      .set({ name, updated_at: new Date().toISOString() })
      .where(eq(schema.customers.id, id))
      .returning({
        id: schema.customers.id,
        name: schema.customers.name,
        factory_id: schema.customers.factory_id,
        created_at: schema.customers.created_at,
        updated_at: schema.customers.updated_at,
      });

    if (!updated) {
      return NextResponse.json(
        { error: "Customer not found or failed to update" },
        { status: StatusCodes.NOT_FOUND },
      );
    }

    return NextResponse.json({
      customer: updated,
      message: `Customer "${name}" updated successfully.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

export async function DELETE(request: Request) {
  try {
    const rawBody = await request.json();
    const validation = deleteCustomersSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Invalid input" },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const { ids } = validation.data;

    // Hard delete with ON DELETE RESTRICT enforcement
    try {
      await db.delete(schema.customers).where(inArray(schema.customers.id, ids));
    } catch (dbErr) {
      const isForeignKeyViolation =
        dbErr instanceof Error &&
        (dbErr.message.includes("FOREIGN KEY") ||
          dbErr.message.includes("constraint failed") ||
          (dbErr as { code?: string }).code === "23503" ||
          (dbErr as { code?: string }).code === "SQLITE_CONSTRAINT");

      if (isForeignKeyViolation) {
        return NextResponse.json(
          { error: "Cannot delete customer because linked entry records exist." },
          { status: StatusCodes.CONFLICT },
        );
      }
      throw dbErr;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${ids.length} customer${ids.length > 1 ? "s" : ""}.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
