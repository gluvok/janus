import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { executeAutomaticWeighmentsQuery } from "@/lib/weighments-query";
import { supabase } from "@/lib/supabase";

const ingestSchema = z.object({
  vehicle_number: z.string().trim().min(1, "vehicle_number is required"),
  "x-api-key": z.string().trim().min(1, "x-api-key is required"),
  weight: z.coerce.number().positive("weight must be a positive number"),
  images: z.array(z.file().min(1)).min(1, "at least two images are required"),
  "idempotency-key": z.uuid("idempotency-key must be a valid UUID"),
});

export async function GET(request: Request) {
  return executeAutomaticWeighmentsQuery(request);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const apiKey = request.headers.get("x-api-key") || formData.get("x-api-key");
    const idempotencyKey = request.headers.get("idempotency-key");

    const validation = ingestSchema.safeParse({
      vehicle_number: formData.get("vehicle_number"),
      "x-api-key": apiKey,
      weight: formData.get("weight"),
      images: formData.getAll("images"),
      "idempotency-key": idempotencyKey,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 },
      );
    }

    const {
      vehicle_number,
      "x-api-key": validatedApiKey,
      weight,
      images,
      "idempotency-key": validatedIdempotencyKey,
    } = validation.data;

    // Check if any weighment exists with the same idempotency key
    const { data: existing } = await supabase
      .from("automatic_weighments")
      .select("id")
      .eq("idempotency_key", validatedIdempotencyKey)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true });
    }

    // Authenticate center via x-api-key in centers table
    const { data: center } = await supabase
      .from("centers")
      .select("id")
      .eq("api_key", validatedApiKey)
      .maybeSingle();

    if (!center) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    // Upload raw images to 'mesto' storage bucket
    const imageUrls: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const ext = images[i].name.split(".").pop()!.toLowerCase();
      const path = `${center.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("mesto")
        .upload(path, images[i], { contentType: images[i].type });

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      imageUrls.push(supabase.storage.from("mesto").getPublicUrl(path).data.publicUrl);
    }

    // Check for latest weighment with status pending for this vehicle
    const { data: pending } = await supabase
      .from("automatic_weighments")
      .select("id")
      .eq("vehicle_number", vehicle_number)
      .eq("type", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pending) {
      const { data, error } = await supabase
        .from("automatic_weighments")
        .update({
          out_weight: weight,
          out_time: new Date().toISOString(),
          out_detected_vehicle_number: vehicle_number,
          out_images: imageUrls,
          out_center_id: center.id,
        })
        .eq("id", pending.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    }

    // Create new weighment record (in_time is defaulted by database)
    const { data, error } = await supabase
      .from("automatic_weighments")
      .insert({
        idempotency_key: validatedIdempotencyKey,
        vehicle_number,
        in_detected_vehicle_number: vehicle_number,
        in_weight: weight,
        in_images: imageUrls,
        in_center_id: center.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
