/**
 * @file scripts/test-seed/photos.ts
 * @description Generates 100% valid, self-contained SVG scale inspection photo cards
 * and uploads them to the Supabase Storage 'mesto' bucket with resilient fallback.
 */

import { SUPABASE_URL, supabase } from "../supabase.ts";

export interface GeneratedPhotoMetadata {
  svgContent: string;
  storagePath: string;
  publicUrl: string;
  dataUri: string;
}

export function generateWeighmentPhotoSvg({
  factoryId,
  mode,
  weighmentIndex,
  direction,
  photoIndex,
  plate,
  scaleName,
}: {
  factoryId: number;
  mode: "auto" | "manual";
  weighmentIndex: number;
  direction: "in" | "out";
  photoIndex: number;
  plate: string;
  scaleName: string;
}): GeneratedPhotoMetadata {
  const isOut = direction === "out";
  const headerColor = isOut ? "#ea580c" : "#0284c7";
  const headerText = isOut ? "OUTBOUND SCALE DEPARTURE" : "INBOUND SCALE INSPECTION";
  const directionBadge = isOut ? "OUTBOUND" : "INBOUND";
  const cameraLabel = `CAM-0${photoIndex + 1} • ${isOut ? "EXIT LANE" : "ENTRY PLATFORM"}`;
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const transitId = `TR-${mode.toUpperCase()}-${factoryId}-${String(weighmentIndex + 1).padStart(3, "0")}-${photoIndex + 1}`;
  const filename = `weighment_${mode}_${weighmentIndex}_${direction}_${photoIndex}.svg`;
  const storagePath = `${factoryId}/${filename}`;

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${headerColor}" />
      <stop offset="100%" stop-color="#334155" />
    </linearGradient>
  </defs>

  <rect width="800" height="500" rx="12" fill="url(#bgGrad)" stroke="#334155" stroke-width="2" />

  <rect x="0" y="0" width="800" height="56" rx="12" fill="url(#headerGrad)" />
  <rect x="0" y="44" width="800" height="12" fill="#0f172a" opacity="0.3" />
  <text x="24" y="36" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" letter-spacing="1.5">${headerText}</text>
  <text x="776" y="36" text-anchor="end" fill="#f8fafc" font-family="ui-monospace, monospace" font-size="13" font-weight="600">${cameraLabel}</text>

  <circle cx="400" cy="210" r="110" fill="none" stroke="#475569" stroke-width="1.5" stroke-dasharray="6 6" opacity="0.4" />
  <circle cx="400" cy="210" r="4" fill="${headerColor}" />
  <line x1="270" y1="210" x2="310" y2="210" stroke="#64748b" stroke-width="1.5" />
  <line x1="490" y1="210" x2="530" y2="210" stroke="#64748b" stroke-width="1.5" />
  <line x1="400" y1="80" x2="400" y2="120" stroke="#64748b" stroke-width="1.5" />
  <line x1="400" y1="300" x2="400" y2="340" stroke="#64748b" stroke-width="1.5" />

  <g transform="translate(290, 150)" opacity="0.85">
    <path d="M 10 70 L 10 30 L 70 30 L 95 50 L 130 50 L 130 70 Z" fill="#334155" stroke="#64748b" stroke-width="2" />
    <rect x="135" y="15" width="80" height="55" rx="3" fill="#1e293b" stroke="#64748b" stroke-width="2" />
    <circle cx="35" cy="74" r="10" fill="#020617" stroke="#94a3b8" stroke-width="2" />
    <circle cx="55" cy="74" r="10" fill="#020617" stroke="#94a3b8" stroke-width="2" />
    <circle cx="150" cy="74" r="10" fill="#020617" stroke="#94a3b8" stroke-width="2" />
    <circle cx="170" cy="74" r="10" fill="#020617" stroke="#94a3b8" stroke-width="2" />
    <circle cx="190" cy="74" r="10" fill="#020617" stroke="#94a3b8" stroke-width="2" />
  </g>

  <rect x="250" y="260" width="300" height="64" rx="8" fill="#f8fafc" stroke="#020617" stroke-width="3" />
  <rect x="254" y="264" width="292" height="56" rx="6" fill="#fef08a" stroke="#ca8a04" stroke-width="1" />
  <rect x="258" y="268" width="32" height="48" rx="4" fill="#1e3a8a" />
  <text x="274" y="298" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-size="12" font-weight="900">IND</text>
  <text x="410" y="307" text-anchor="middle" fill="#0f172a" font-family="ui-monospace, monospace" font-size="28" font-weight="900" letter-spacing="4">${plate}</text>

  <rect x="40" y="350" width="720" height="8" rx="4" fill="#334155" />
  <rect x="120" y="358" width="560" height="4" rx="2" fill="${headerColor}" opacity="0.6" />

  <rect x="24" y="380" width="752" height="96" rx="8" fill="#090d16" stroke="#1e293b" stroke-width="1.5" />
  
  <text x="44" y="415" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11" font-weight="600">SCALE / FACILITY</text>
  <text x="44" y="445" fill="#f1f5f9" font-family="system-ui, sans-serif" font-size="15" font-weight="700">${scaleName}</text>

  <text x="330" y="415" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11" font-weight="600">TRANSIT DIRECTION</text>
  <rect x="330" y="426" width="90" height="26" rx="5" fill="${isOut ? "#431407" : "#0c4a6e"}" stroke="${isOut ? "#ea580c" : "#0284c7"}" stroke-width="1" />
  <text x="375" y="443" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-size="11" font-weight="800">${directionBadge}</text>

  <text x="540" y="415" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11" font-weight="600">IDENTIFIER &amp; TIME</text>
  <text x="540" y="444" fill="#38bdf8" font-family="ui-monospace, monospace" font-size="12" font-weight="700">${transitId} • ${timestamp}</text>
</svg>`;

  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/mesto/${storagePath}`;

  return {
    svgContent,
    storagePath,
    publicUrl,
    dataUri,
  };
}

/**
 * Uploads generated SVG photos to the 'mesto' Supabase Storage bucket in parallel batches.
 * If storage upload succeeds, returns the public bucket URL.
 * If storage is unreachable or offline, returns the self-contained SVG Data URI.
 */
export async function uploadOrFallbackPhotos(
  photos: GeneratedPhotoMetadata[],
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  if (photos.length === 0) return urlMap;

  console.log(
    `\n📸 Synchronizing ${photos.length} weighment photos with Supabase Storage ('mesto' bucket)...`,
  );

  let storageAccessible = true;
  const BATCH_SIZE = 10;

  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    const batch = photos.slice(i, i + BATCH_SIZE);

    if (storageAccessible) {
      const uploadPromises = batch.map(async (photo) => {
        try {
          const { error } = await supabase.storage
            .from("mesto")
            .upload(photo.storagePath, Buffer.from(photo.svgContent), {
              contentType: "image/svg+xml",
              upsert: true,
            });

          if (!error) {
            urlMap.set(photo.storagePath, photo.publicUrl);
          } else {
            urlMap.set(photo.storagePath, photo.dataUri);
          }
        } catch {
          storageAccessible = false;
          urlMap.set(photo.storagePath, photo.dataUri);
        }
      });

      await Promise.all(uploadPromises);
    } else {
      for (const photo of batch) {
        urlMap.set(photo.storagePath, photo.dataUri);
      }
    }
  }

  const uploadedCount = Array.from(urlMap.values()).filter((u) => !u.startsWith("data:")).length;
  if (uploadedCount > 0) {
    console.log(
      `  ✓ Successfully uploaded ${uploadedCount} photos to Supabase Storage 'mesto' bucket.`,
    );
  } else {
    console.log(
      "  ℹ️ Storage offline or sandbox network isolated; using 100% valid self-contained SVG Data URIs.",
    );
  }

  return urlMap;
}
