import { z } from "zod";
import { vehicleNumberSchema } from "./helpers.ts";

export const NO_PLATE = "NO_PLATE_DETECTED";
export const MAX_INGEST_IMAGES = 3;
// Vercel rejects request bodies over 4.5 MB before the route runs, so cap the images below that.
// This also bounds any single image, so there is no separate per-image limit.
export const MAX_TOTAL_IMAGE_BYTES = 4_000_000;

/** Hermes device ingest: one multipart upload, plus the Idempotency-Key header as `idempotency_key`. */
export const ingestSchema = z.object({
  // UUIDs are path-safe (the key becomes part of the storage path); lowercased so app and DB agree.
  idempotency_key: z
    .uuidv7({
      error: (issue) =>
        issue.input === undefined
          ? "Idempotency-Key header is required."
          : "Idempotency-Key must be a UUIDv7.",
    })
    .toLowerCase(),
  vehicle_number: z.preprocess(
    (v) =>
      typeof v === "string" && /^\s*(NO_PLATE_DETECTED|REJECTED_\w*)\s*$/i.test(v) ? NO_PLATE : v,
    z.union([z.literal(NO_PLATE), vehicleNumberSchema]),
  ),
  weight: z.coerce.number().positive().max(99_999_999.99), // DECIMAL(10, 2)
  images: z
    .array(z.instanceof(File))
    .max(MAX_INGEST_IMAGES, `At most ${MAX_INGEST_IMAGES} images.`)
    .refine((files) => files.every((f) => f.type === "image/jpeg"), {
      message: "Images must be JPEG.",
    })
    .refine((files) => files.reduce((total, f) => total + f.size, 0) <= MAX_TOTAL_IMAGE_BYTES, {
      message: "Images must total at most 4 MB.",
    }),
});
