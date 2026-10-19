import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { executeEntriesGetQuery } from "@/lib/entries-query";
import { updateAutomaticEntrySchema } from "@/lib/validation";

export async function GET(request: Request) {
  return executeEntriesGetQuery(request, "automatic");
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
    const { data: existing, error: fetchError } = await supabase
      .from("automatic_entries")
      .select("id, vehicle_number, detected_vehicle_number, customer_id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchError || !existing) {
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
      const { data: customerRecord } = await supabase
        .from("customers")
        .select("id")
        .eq("id", customer_id)
        .is("deleted_at", null)
        .maybeSingle();

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

    const { data, error: updateError } = await supabase
      .from("automatic_entries")
      .update(updates)
      .eq("id", id)
      .select("id, vehicle_number, detected_vehicle_number, customer_id, updated_at")
      .single();

    if (updateError || !data) {
      return NextResponse.json(
        { error: updateError?.message ?? "Failed to update entry" },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    return NextResponse.json(
      {
        entry: data,
        message: "Entry updated successfully.",
      },
      { status: StatusCodes.OK },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
