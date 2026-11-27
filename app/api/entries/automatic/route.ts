import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";
import { executePaginatedEntityQuery, applyCommaSeparatedIdFilter } from "@/lib/api-query";
import { handleApiRoute } from "@/lib/api-handler";
import { hashApiKey } from "@/lib/api-key";
import { supabase } from "@/lib/supabase";
import { ingestSchema } from "@/lib/validation/ingest";
import { AUTOMATIC_ENTRY_SELECT_PROJECTION, type AutomaticEntry } from "@/app/entries/types";

const ALLOWED_SORT_COLUMNS = [
  "id",
  "vehicle_number",
  "weight",
  "center_id",
  "center_name",
  "created_at",
  "updated_at",
] as const;

export const GET = handleApiRoute(async (request: Request) => {
  return executePaginatedEntityQuery<(typeof ALLOWED_SORT_COLUMNS)[number], AutomaticEntry>({
    request,
    table: "automatic_entries_view",
    select: AUTOMATIC_ENTRY_SELECT_PROJECTION,
    allowedSortColumns: ALLOWED_SORT_COLUMNS,
    defaultSort: { col: "created_at", ascending: false },
    searchColumns: ["vehicle_number", "center_name"],
    integerColumns: ["id"],
    numericColumns: ["weight"],
    integerFilterColumns: ["id"],
    applyCustomFilters: (query, params) =>
      applyCommaSeparatedIdFilter(
        query,
        params.get("center_id") || params.get("center_ids"),
        "center_id",
      ),
  });
});

// ---- Device ingest (Hermes): POST, authenticated by `x-api-key`, no session ----

const BUCKET = "mesto";
// ponytail: per-instance counters, so the real ceiling is 5/min x instance count; use a shared store if that matters.
const limiter = new RateLimiterMemory({ points: 5, duration: 60 });

const json = (body: unknown, status: number, headers?: HeadersInit) =>
  NextResponse.json(body, { status, headers });
const unauthorized = () => json({ error: "Unauthorized" }, StatusCodes.UNAUTHORIZED);

const field = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : undefined;
};

interface IngestRow {
  entry_id: number;
  weighment_id: number | null;
  replayed: boolean;
}

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) return unauthorized();
    const keyHash = hashApiKey(apiKey);

    // Counts every request, valid key or not, and runs before the DB lookup.
    try {
      await limiter.consume(keyHash);
    } catch (rejected) {
      if (!(rejected instanceof RateLimiterRes)) throw rejected;
      return json({ error: "Too many requests." }, StatusCodes.TOO_MANY_REQUESTS, {
        "Retry-After": String(Math.ceil(rejected.msBeforeNext / 1000)),
      });
    }

    const { data: center, error: centerError } = await supabase
      .from("centers")
      .select("id, factory_id")
      .eq("api_key_hash", keyHash)
      .maybeSingle();
    if (centerError) throw centerError;
    if (!center) return unauthorized();

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ error: "Expected multipart/form-data." }, StatusCodes.BAD_REQUEST);
    }

    const parsed = ingestSchema.safeParse({
      idempotency_key: request.headers.get("idempotency-key") ?? undefined,
      vehicle_number: field(form, "vehicle_number"),
      weight: field(form, "weight"),
      // Hermes's storage fallback re-sends one zero-byte file: treat it as "no images".
      images: form.getAll("file").filter((f) => !(f instanceof File) || f.size > 0),
    });
    if (!parsed.success) {
      return json({ error: parsed.error.issues[0].message }, StatusCodes.BAD_REQUEST);
    }
    const { idempotency_key: idempotencyKey, vehicle_number: plate, weight, images } = parsed.data;

    // Path is deterministic per (center, key, index): a replay overwrites instead of orphaning files.
    const urls: string[] = [];
    for (const [i, image] of images.entries()) {
      const path = `${center.factory_id}/automatic/${center.id}/${idempotencyKey}_${i}.jpg`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, Buffer.from(await image.arrayBuffer()), {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (error) {
        console.error("Ingest image upload failed:", error);
        // Hermes matches "storage" in a 400 body and retries without images.
        return json({ error: "Image storage failed." }, StatusCodes.BAD_REQUEST);
      }
      urls.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    }

    const { data, error: rpcError } = await supabase.rpc("ingest_automatic_entry", {
      p_center_id: center.id,
      p_idempotency_key: idempotencyKey,
      p_vehicle_number: plate,
      p_weight: weight,
      p_images: urls,
    });
    if (rpcError) throw rpcError;
    const row = (data as IngestRow[] | null)?.[0];
    if (!row) throw new Error("ingest_automatic_entry returned no row");

    return json(
      { data: { id: row.entry_id, weighment_id: row.weighment_id } },
      row.replayed ? StatusCodes.OK : StatusCodes.CREATED,
    );
  } catch (error) {
    console.error("Device ingest failed:", error);
    return json({ error: "Internal Server Error" }, StatusCodes.INTERNAL_SERVER_ERROR);
  }
}
