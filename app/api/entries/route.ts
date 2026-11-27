import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { LRUCache } from "lru-cache";
import { supabase } from "@/lib/supabase";
import { parseBasicAuth } from "@/lib/security";
import { apiKeyMatches, DUMMY_KEY_HASH } from "@/lib/api-key";
import { vehicleNumberSchema } from "@/lib/validation/helpers";

const BUCKET = "mesto";
const NO_PLATE = "NO_PLATE_DETECTED";
const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_ENTRIES_PER_MINUTE = 30;
// ponytail: per-instance fixed window; move to a DB/Redis counter if instances scale out.
const recentEntries = new LRUCache<number, number>({ max: 10_000, ttl: 60_000, noUpdateTTL: true });

const json = (body: unknown, status: number) => NextResponse.json(body, { status });
const UNAUTHORIZED = () =>
  NextResponse.json(
    { error: "Unauthorized" },
    { status: StatusCodes.UNAUTHORIZED, headers: { "WWW-Authenticate": 'Basic realm="janus"' } },
  );

const entrySchema = z.object({
  center_id: z.coerce.number().int().positive().optional(),
  detected_vehicle_number: z.preprocess(
    (v) =>
      typeof v === "string" && /^\s*(NO_PLATE_DETECTED|REJECTED_\w*)\s*$/i.test(v) ? NO_PLATE : v,
    z.union([z.literal(NO_PLATE), vehicleNumberSchema]),
  ),
  weight: z.coerce.number().positive().max(99_999_999.99), // DECIMAL(10, 2)
});

const field = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : undefined;
};

export async function POST(request: Request) {
  try {
    const creds = parseBasicAuth(request.headers.get("authorization"));
    const centerId = creds && /^\d{1,9}$/.test(creds.id) ? Number(creds.id) : 0;
    if (!creds || !centerId) return UNAUTHORIZED();

    const { data: center, error: centerError } = await supabase
      .from("centers")
      .select("id, factory_id, api_key_hash")
      .eq("id", centerId)
      .maybeSingle();
    if (centerError) throw centerError;
    // Unknown center and wrong key run the same compare and return the same 401.
    if (!apiKeyMatches(creds.key, center?.api_key_hash ?? DUMMY_KEY_HASH) || !center) {
      return UNAUTHORIZED();
    }

    const count = recentEntries.get(center.id) ?? 0;
    if (count >= MAX_ENTRIES_PER_MINUTE) {
      return json({ error: "Too many requests." }, StatusCodes.TOO_MANY_REQUESTS);
    }
    recentEntries.set(center.id, count + 1);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ error: "Expected multipart/form-data." }, StatusCodes.BAD_REQUEST);
    }

    const parsed = entrySchema.safeParse({
      center_id: field(form, "center_id"),
      detected_vehicle_number: field(form, "detected_vehicle_number"),
      weight: field(form, "weight"),
    });
    if (!parsed.success) {
      return json({ error: parsed.error.issues[0].message }, StatusCodes.BAD_REQUEST);
    }
    const { center_id: claimedCenter, detected_vehicle_number: plate, weight } = parsed.data;
    if (claimedCenter !== undefined && claimedCenter !== center.id) {
      return json({ error: "center_id does not match credentials." }, StatusCodes.FORBIDDEN);
    }

    // Hermes's storage fallback re-sends one zero-byte file: treat it as "no images".
    const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > MAX_IMAGES) {
      return json({ error: `At most ${MAX_IMAGES} images.` }, StatusCodes.BAD_REQUEST);
    }
    if (files.some((f) => f.type !== "image/jpeg" || f.size > MAX_IMAGE_BYTES)) {
      return json({ error: "Images must be JPEG and at most 5 MB." }, StatusCodes.BAD_REQUEST);
    }
    const bodies = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));

    // Same photos + plate + weight from the same center = a retried request (Hermes retries on timeout).
    const idempotencyKey = bodies.length
      ? createHash("sha256")
          .update(`${center.id}|${plate}|${weight}|`)
          .update(bodies.map((b) => createHash("sha256").update(b).digest("hex")).join(","))
          .digest("hex")
      : randomUUID();

    const images: string[] = [];
    for (const [i, body] of bodies.entries()) {
      const path = `${center.factory_id}/automatic/${center.id}/${idempotencyKey}_${i}.jpg`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, body, { contentType: "image/jpeg", upsert: true });
      if (error) {
        console.error("Ingest image upload failed:", error);
        // Hermes matches "storage" in a 400 body and retries without images.
        return json({ error: "Image storage failed." }, StatusCodes.BAD_REQUEST);
      }
      images.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    }

    const { data: entry, error: insertError } = await supabase
      .from("automatic_entries")
      .insert({
        center_id: center.id,
        vehicle_number: plate,
        weight,
        images,
        idempotency_key: idempotencyKey,
      })
      .select("id")
      .single();

    if (insertError?.code === "23505") {
      const { data: existing, error } = await supabase
        .from("automatic_entries")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .single();
      if (error) throw error;
      return json({ data: { id: existing.id } }, StatusCodes.OK);
    }
    if (insertError?.code === "23514") {
      return json({ error: "Entry failed validation." }, StatusCodes.BAD_REQUEST);
    }
    if (insertError) throw insertError;

    return json({ data: { id: entry.id } }, StatusCodes.CREATED);
  } catch (error) {
    console.error("Device ingest failed:", error);
    return json({ error: "Internal Server Error" }, StatusCodes.INTERNAL_SERVER_ERROR);
  }
}
