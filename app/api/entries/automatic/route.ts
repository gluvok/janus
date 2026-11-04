import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { executeEntriesGetQuery, executeEntriesDelete } from "@/lib/entries-query";
import { updateAutomaticEntrySchema } from "@/lib/validation";

export async function GET(request: Request) {
  return executeEntriesGetQuery(request, "automatic");
}

export async function DELETE(request: Request) {
  return executeEntriesDelete(request, "automatic_entries");
}

export async function PATCH(request: Request) {
  try {
    const rawBody = await request.json();
    const validation = updateAutomaticEntrySchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Invalid input" },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const { id, vehicle_number, customer_id } = validation.data;

    // Fetch existing automatic entry
    const existing = await db
      .select({
        id: schema.automatic_entries.id,
        vehicle_number: schema.automatic_entries.vehicle_number,
        detected_vehicle_number: schema.automatic_entries.detected_vehicle_number,
        customer_id: schema.automatic_entries.customer_id,
      })
      .from(schema.automatic_entries)
      .where(eq(schema.automatic_entries.id, id))
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) {
      return NextResponse.json(
        { error: "Automatic entry not found" },
        { status: StatusCodes.NOT_FOUND },
      );
    }

    // Guard: vehicle_number can only be edited if vehicle_number === detected_vehicle_number
    if (vehicle_number) {
      if (existing.vehicle_number !== existing.detected_vehicle_number) {
        return NextResponse.json(
          { error: "Vehicle number cannot be edited once it has been corrected." },
          { status: StatusCodes.BAD_REQUEST },
        );
      }
    }

    // Guard: customer_id cannot be changed once assigned
    if (customer_id) {
      if (existing.customer_id) {
        return NextResponse.json(
          { error: "Customer cannot be changed once assigned." },
          { status: StatusCodes.BAD_REQUEST },
        );
      }

      // Verify target customer exists
      const customerRecord = await db
        .select({ id: schema.customers.id })
        .from(schema.customers)
        .where(eq(schema.customers.id, customer_id))
        .limit(1)
        .then((rows) => rows[0]);

      if (!customerRecord) {
        return NextResponse.json(
          { error: "Selected customer does not exist." },
          { status: StatusCodes.BAD_REQUEST },
        );
      }
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (vehicle_number) {
      updates.vehicle_number = vehicle_number;
    }
    if (customer_id) {
      updates.customer_id = customer_id;
    }

    const [updated] = await db
      .update(schema.automatic_entries)
      .set(updates)
      .where(eq(schema.automatic_entries.id, id))
      .returning({
        id: schema.automatic_entries.id,
        vehicle_number: schema.automatic_entries.vehicle_number,
        detected_vehicle_number: schema.automatic_entries.detected_vehicle_number,
        customer_id: schema.automatic_entries.customer_id,
        updated_at: schema.automatic_entries.updated_at,
      });

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update entry" },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    return NextResponse.json(
      {
        entry: updated,
        message: "Entry updated successfully.",
      },
      { status: StatusCodes.OK },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
