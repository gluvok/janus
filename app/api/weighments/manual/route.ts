import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { executeWeighmentsGetQuery } from "@/lib/weighments-query";
import { createManualWeighmentSchema, updateWeighmentSchema } from "@/app/weighments/types";

export async function GET(request: Request) {
  return executeWeighmentsGetQuery(request, "manual");
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const validation = createManualWeighmentSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Invalid input" },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const {
      vehicle_number,
      in_weight,
      in_center_id,
      in_creator_id,
      out_weight,
      out_center_id,
      out_creator_id,
      images = [],
    } = validation.data;

    const normalizedPlate = vehicle_number.toUpperCase().trim();

    // Check if open pending weighment exists for this vehicle
    const { data: openWeighment } = await supabase
      .from("manual_weighments")
      .select("id, images")
      .eq("vehicle_number", normalizedPlate)
      .is("out_weight", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openWeighment && out_weight) {
      // Complete existing weighment
      const updatedImages = Array.from(new Set([...(openWeighment.images ?? []), ...images]));
      const { data: completed, error: updateError } = await supabase
        .from("manual_weighments")
        .update({
          out_weight,
          out_time: new Date().toISOString(),
          out_center_id: out_center_id ?? in_center_id,
          out_creator_id: out_creator_id ?? in_creator_id,
          images: updatedImages,
        })
        .eq("id", openWeighment.id)
        .select()
        .single();

      if (updateError || !completed) {
        return NextResponse.json(
          { error: updateError?.message ?? "Failed to complete weighment" },
          { status: StatusCodes.INTERNAL_SERVER_ERROR },
        );
      }

      return NextResponse.json({
        weighment: completed,
        action: "completed",
        message: `Outbound weighing recorded for ${normalizedPlate}. Weighment completed.`,
      });
    }

    // Insert new manual weighment
    const insertPayload: Record<string, unknown> = {
      vehicle_number: normalizedPlate,
      in_weight,
      in_time: new Date().toISOString(),
      in_center_id,
      in_creator_id,
      images,
    };

    if (out_weight !== undefined) {
      insertPayload.out_weight = out_weight;
      insertPayload.out_time = new Date().toISOString();
      insertPayload.out_center_id = out_center_id ?? in_center_id;
      insertPayload.out_creator_id = out_creator_id ?? in_creator_id;
    }

    const { data: created, error: insertError } = await supabase
      .from("manual_weighments")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError || !created) {
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to create manual weighment" },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    return NextResponse.json(
      {
        weighment: created,
        action: out_weight ? "completed" : "inbound_created",
        message: `Manual weighment recorded for ${normalizedPlate}.`,
      },
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
    const validation = updateWeighmentSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Invalid input" },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const { id, vehicle_number, in_weight, out_weight, in_center_id, out_center_id, images } =
      validation.data;

    const updates: Record<string, unknown> = {};

    if (vehicle_number !== undefined) {
      updates.vehicle_number = vehicle_number.toUpperCase().trim();
    }
    if (in_weight !== undefined) updates.in_weight = in_weight;
    if (out_weight !== undefined) updates.out_weight = out_weight;
    if (in_center_id !== undefined) updates.in_center_id = in_center_id;
    if (out_center_id !== undefined) updates.out_center_id = out_center_id;
    if (images !== undefined) updates.images = images;

    const { data: updated, error: updateError } = await supabase
      .from("manual_weighments")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message ?? "Failed to update weighment" },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Weighment not found or has been deleted." },
        { status: StatusCodes.NOT_FOUND },
      );
    }

    return NextResponse.json({
      weighment: updated,
      message: `Weighment #${id} updated successfully.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}
