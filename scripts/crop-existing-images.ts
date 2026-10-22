/**
 * @file scripts/crop-existing-images.ts
 * @description Retroactive migration script: downloads all existing entry images from
 * Supabase Storage, applies per-camera crop configuration from each factory's
 * `camera_crops` JSONB column, then re-uploads the cropped versions in-place.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/crop-existing-images.ts
 *   pnpm tsx --env-file=.env.local scripts/crop-existing-images.ts --dry-run
 *   pnpm tsx --env-file=.env.local scripts/crop-existing-images.ts --factory-id 1
 *
 * Flags:
 *   --dry-run       Download and test crop math without writing to storage.
 *   --factory-id N  Only process entries for this factory ID.
 *
 * Safety:
 *   - Each overwrite uses upsert: true — the original is replaced in-place.
 *   - Crop errors on individual images are logged but do not halt the entire run.
 *   - Progress is logged to stdout continuously.
 */

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const BUCKET = "gluvok";
const PUBLIC_URL_INDICATOR = "/public/gluvok/";
const JPEG_QUALITY = 85;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY env vars.\n" +
      "Run with: pnpm tsx --env-file=.env.local scripts/crop-existing-images.ts",
  );
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const factoryIdArg = args.find((a) => a.startsWith("--factory-id"));
const FILTER_FACTORY_ID = factoryIdArg
  ? Number(factoryIdArg.split("=")[1] ?? args[args.indexOf(factoryIdArg) + 1])
  : null;

interface CameraCropConfig {
  camera: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractStoragePath(url: string): string | null {
  if (url.includes(PUBLIC_URL_INDICATOR)) {
    return url.split(PUBLIC_URL_INDICATOR)[1] ?? null;
  }
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return url; // already a relative path
  }
  return null;
}

async function cropBuffer(buffer: Buffer, crop: CameraCropConfig): Promise<Buffer> {
  const { width: W, height: H } = await sharp(buffer).metadata();
  if (!W || !H) throw new Error("Cannot read image dimensions");

  const left = Math.round(W * (crop.left / 100));
  const top = Math.round(H * (crop.top / 100));
  const width = W - left - Math.round(W * (crop.right / 100));
  const height = H - top - Math.round(H * (crop.bottom / 100));

  if (width <= 0 || height <= 0) {
    throw new Error(`Crop produces invalid dimensions ${width}x${height} from ${W}x${H}`);
  }

  return sharp(buffer)
    .extract({ left, top, width, height })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`🚀 Starting retroactive image crop migration`);
  console.log(`   Mode    : ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`   Factory : ${FILTER_FACTORY_ID ?? "ALL"}\n`);

  // 1. Fetch factories and their camera_crops configs
  let factoriesQuery = supabase
    .from("factories")
    .select("id, name, camera_crops")
    .is("deleted_at", null);
  if (FILTER_FACTORY_ID) factoriesQuery = factoriesQuery.eq("id", FILTER_FACTORY_ID);
  const { data: factories, error: factoriesErr } = await factoriesQuery;
  if (factoriesErr || !factories) {
    console.error("Failed to fetch factories:", factoriesErr);
    process.exit(1);
  }
  console.log(`📋 Found ${factories.length} factory/factories to process\n`);

  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const factory of factories) {
    const cropConfigs: CameraCropConfig[] = Array.isArray(factory.camera_crops)
      ? (factory.camera_crops as CameraCropConfig[])
      : [
          { camera: 1, top: 5, bottom: 34, left: 37, right: 28 },
          { camera: 2, top: 12, bottom: 31, left: 20, right: 49 },
        ];

    console.log(`🏭 Factory: ${factory.name} (ID ${factory.id})`);
    console.log(`   Crop configs: ${JSON.stringify(cropConfigs)}`);

    // 2. Fetch all non-deleted entries with images for this factory, paginated
    let page = 0;
    const PAGE_SIZE = 100;

    while (true) {
      const { data: entries, error: entriesErr } = await supabase
        .from("entries")
        .select("id, images, centers!inner(factory_id)")
        .eq("centers.factory_id", factory.id)
        .is("deleted_at", null)
        .not("images", "eq", "{}")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (entriesErr) {
        console.error(`   Error fetching entries (page ${page}):`, entriesErr);
        break;
      }
      if (!entries || entries.length === 0) break;

      for (const entry of entries) {
        const images: string[] = Array.isArray(entry.images) ? entry.images : [];
        if (images.length === 0) {
          totalSkipped++;
          continue;
        }

        const updatedUrls: string[] = [];
        let entryChanged = false;

        for (let slotIndex = 0; slotIndex < images.length; slotIndex++) {
          const url = images[slotIndex];
          const storagePath = extractStoragePath(url);

          if (!storagePath) {
            console.warn(`   [Entry ${entry.id}] slot ${slotIndex}: unrecognised URL, skipping`);
            updatedUrls.push(url);
            continue;
          }

          const cropConfig = cropConfigs.find((c) => c.camera === slotIndex + 1);
          if (!cropConfig) {
            // No crop defined for this slot — leave as-is
            updatedUrls.push(url);
            continue;
          }

          try {
            // Download original
            const { data: fileData, error: downloadErr } = await supabase.storage
              .from(BUCKET)
              .download(storagePath);
            if (downloadErr || !fileData) {
              throw new Error(`Download failed: ${downloadErr?.message}`);
            }

            const arrayBuffer = await fileData.arrayBuffer();
            const originalBuffer = Buffer.from(arrayBuffer);
            const croppedBuffer = await cropBuffer(originalBuffer, cropConfig);

            if (DRY_RUN) {
              const { width: W, height: H } = await sharp(originalBuffer).metadata();
              const { width: cW, height: cH } = await sharp(croppedBuffer).metadata();
              console.log(`   [DRY] Entry ${entry.id} slot ${slotIndex}: ${W}x${H} → ${cW}x${cH}`);
            } else {
              // Overwrite in-place
              const { error: uploadErr } = await supabase.storage
                .from(BUCKET)
                .upload(storagePath, croppedBuffer, {
                  contentType: "image/jpeg",
                  cacheControl: "3600",
                  upsert: true,
                });
              if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);
              console.log(
                `   ✅ Entry ${entry.id} slot ${slotIndex} (cam ${slotIndex + 1}) cropped`,
              );
            }

            updatedUrls.push(url); // URL stays the same (same path, overwritten content)
            entryChanged = true;
            totalProcessed++;
          } catch (err) {
            console.error(`   ❌ Entry ${entry.id} slot ${slotIndex}:`, err);
            updatedUrls.push(url); // Keep original URL on failure
            totalErrors++;
          }
        }

        // No DB update needed since URLs are unchanged (same storage path, content replaced)
        if (!entryChanged) totalSkipped++;
      }

      if (entries.length < PAGE_SIZE) break;
      page++;
    }

    console.log();
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("=".repeat(60));
  console.log(`✅ Completed ${DRY_RUN ? "(DRY RUN — no writes performed)" : ""}`);
  console.log(`   Processed : ${totalProcessed} images`);
  console.log(`   Skipped   : ${totalSkipped} entries (no images or no crop config)`);
  console.log(`   Errors    : ${totalErrors} images`);
  console.log("=".repeat(60));

  if (totalErrors > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
