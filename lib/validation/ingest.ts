import { z } from "zod";
import { vehicleNumberSchema } from "./helpers.ts";

export const NO_PLATE = "NO_PLATE_DETECTED";
export const MAX_INGEST_IMAGES = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Hermes device ingest: one multipart upload, plus the Idempotency-Key header as `idempotency_key`. */
export const ingestSchema = z.object({
  // Charset is restricted because the key becomes part of the storage path.
  idempotency_key: z
    .string({ error: "Idempotency-Key header is required." })
    .trim()
    .min(8)
    .max(128)
    .regex(/^[\w-]+$/, "Idempotency-Key may only contain letters, digits, '_' and '-'."),
  vehicle_number: z.preprocess(
    (v) =>
      typeof v === "string" && /^\s*(NO_PLATE_DETECTED|REJECTED_\w*)\s*$/i.test(v) ? NO_PLATE : v,
    z.union([z.literal(NO_PLATE), vehicleNumberSchema]),
  ),
  weight: z.coerce.number().positive().max(99_999_999.99), // DECIMAL(10, 2)
  images: z
    .array(z.instanceof(File))
    .max(MAX_INGEST_IMAGES, `At most ${MAX_INGEST_IMAGES} images.`)
    .refine((files) => files.every((f) => f.type === "image/jpeg" && f.size <= MAX_IMAGE_BYTES), {
      message: "Images must be JPEG and at most 5 MB.",
    }),
});
