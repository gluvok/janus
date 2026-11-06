import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/lib/supabase";
import { executeWeighmentsGetQuery } from "@/lib/weighments-query";
import { ingestAutomaticWeighmentSchema, updateWeighmentSchema } from "@/app/weighments/types";
import { handleApiRoute } from "@/lib/api-handler";

export async function GET(request: Request) {
  return executeWeighmentsGetQuery(request, "automatic");
}

export const POST = handleApiRoute(async (request: Request) => {
  const rawBody = await request.json();
  const validation = ingestAutomaticWeighmentSchema.safeParse(rawBody);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const { vehicle_number, weight, center_id, detected_vehicle_number, images } = validation.data;

  const normalizedPlate = vehicle_number.toUpperCase().trim();

  // Look for an existing open (pending) weighment for this vehicle
  const { data: openWeighment, error: findError } = await supabase
    .from("automatic_weighments")
    .select("id, images, in_weight")
    .eq("vehicle_number", normalizedPlate)
    .is("out_weight", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) {
    return NextResponse.json(
      { error: findError.message },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }

  if (openWeighment) {
    // Complete existing weighment as outbound weighing
    const updatedImages = Array.from(new Set([...openWeighment.images, ...images]));
    const { data: completed, error: updateError } = await supabase
      .from("automatic_weighments")
      .update({
        out_weight: weight,
        out_time: new Date().toISOString(),
        out_center_id: center_id,
        out_detected_vehicle_number: detected_vehicle_number ?? null,
        images: updatedImages,
      })
      .eq("id", openWeighment.id)
      .select()
      .single();

    if (updateError || !completed) {
      return NextResponse.json(
        { error: updateError ? updateError.message : "Failed to complete weighment" },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    return NextResponse.json({
      weighment: completed,
      action: "completed",
      message: `Outbound weighing recorded for ${normalizedPlate}. Weighment completed.`,
    });
  }

  // Otherwise, create a new inbound pending weighment
  const { data: created, error: insertError } = await supabase
    .from("automatic_weighments")
    .insert({
      vehicle_number: normalizedPlate,
      in_weight: weight,
      in_time: new Date().toISOString(),
      in_center_id: center_id,
      in_detected_vehicle_number: detected_vehicle_number ?? null,
      images,
    })
    .select()
    .single();

  if (insertError || !created) {
    return NextResponse.json(
      { error: insertError ? insertError.message : "Failed to create inbound weighment" },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }

  return NextResponse.json(
    {
      weighment: created,
      action: "inbound_created",
      message: `Inbound weighing recorded for ${normalizedPlate}.`,
    },
    { status: StatusCodes.CREATED },
  );
});

export const PATCH = handleApiRoute(async (request: Request) => {
  const rawBody = await request.json();
  const validation = updateWeighmentSchema.safeParse(rawBody);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const { id, vehicle_number, in_weight, out_weight, in_center_id, out_center_id, images } =
    validation.data;

  const rawUpdates = {
    vehicle_number: vehicle_number ? vehicle_number.toUpperCase().trim() : undefined,
    in_weight,
    out_weight,
    in_center_id,
    out_center_id,
    images,
  };
  const updates = Object.fromEntries(Object.entries(rawUpdates).filter(([, v]) => v !== undefined));

  const { data: updated, error: updateError } = await supabase
    .from("automatic_weighments")
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
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
});
