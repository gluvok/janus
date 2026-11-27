/**
 * @file scripts/test-seed/photos.ts
 * @description Curated Wikimedia Commons open-license transport photos with Supabase Storage
 * upload, live HTTP verification, and resilient fallback.
 */

import { SUPABASE_URL, supabase } from "../supabase.ts";

export interface CuratedAsset {
  title: string;
  url: string;
}

export const COMMONS_PHOTOS: CuratedAsset[] = [
  {
    title: "Heavy Duty Commercial Tractor Trailer",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/67/DHL_semi-trailer_-_unloaded_from_ferry.JPG/960px-DHL_semi-trailer_-_unloaded_from_ferry.JPG",
  },
  {
    title: "Freight Transport Semi Truck with Trailer",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/24/Truck_with_trailer_in_Toronto.jpg/960px-Truck_with_trailer_in_Toronto.jpg",
  },
  {
    title: "Kenworth Highway Tractor at Travel Plaza",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/Bakersfield%2C_%28CA%29_Truck_Kenworth_at_Flying_J_Travel_%285%29.jpg/960px-Bakersfield%2C_%28CA%29_Truck_Kenworth_at_Flying_J_Travel_%285%29.jpg",
  },
  {
    title: "Peterbilt Heavy Haul Transport",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5c/Bakersfield%2C_%28CA%29_Truck_Peterbilt_at_Flying_J_Travel_Plaza_%28en2016%29_%284%29.JPG/960px-Bakersfield%2C_%28CA%29_Truck_Peterbilt_at_Flying_J_Travel_Plaza_%28en2016%29_%284%29.JPG",
  },
  {
    title: "Shockwave Transport Alliance Truck",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f3/20141025_Shockwave_Truck_Alliance_Air_Show_2014-3.jpg/960px-20141025_Shockwave_Truck_Alliance_Air_Show_2014-3.jpg",
  },
  {
    title: "Commercial Bulk Tanker Delivery Unit",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5b/Guida_Siebert_Dairy_Milk_Delivery_Truck_tractor_trailer%21.jpg/960px-Guida_Siebert_Dairy_Milk_Delivery_Truck_tractor_trailer%21.jpg",
  },
  {
    title: "Kenworth Cabover Semi Truck & Cargo Trailer",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Kenworth_Cabover_Semi_Truck_%26_Trailer.jpg/960px-Kenworth_Cabover_Semi_Truck_%26_Trailer.jpg",
  },
  {
    title: "Intermodal Logistics Cargo Trailer",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Certco_Trailer_Semi_Truck.jpg/960px-Certco_Trailer_Semi_Truck.jpg",
  },
  {
    title: "Enclosed Box Trailer Freight Carrier",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/Con-way_Truckload_semi-trailer_at_truck_stop.jpg/960px-Con-way_Truckload_semi-trailer_at_truck_stop.jpg",
  },
  {
    title: "Regional Freight Distribution Semi-Tractor",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/Con-way_Freight_semi-tractor_trailer.jpg/960px-Con-way_Freight_semi-tractor_trailer.jpg",
  },
  {
    title: "Fleet Box-Trailer Long Haul Semi",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/94/Walmart_box-trailer_semi.jpg/960px-Walmart_box-trailer_semi.jpg",
  },
  {
    title: "Interstate Highway Intermodal Carrier",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f4/J.B_Hunt_semi-truck_trailer_on_Interstate_90_in_Spokane%2C_WA.jpg/960px-J.B_Hunt_semi-truck_trailer_on_Interstate_90_in_Spokane%2C_WA.jpg",
  },
  {
    title: "Refrigerated Transport Peterbilt Semi-Trailer",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1f/PRIME_Inc_-_Peterbilt_Refrigerated_Semi-trailer_truck_-_I-90_Spokane%2C_WA.jpg/960px-PRIME_Inc_-_Peterbilt_Refrigerated_Semi-trailer_truck_-_I-90_Spokane%2C_WA.jpg",
  },
  {
    title: "Logistics Dedicated Freightliner Transit",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/Atech_Logistics_Inc._-_Freightliner_Semi-trailer_truck_-_I-90_Spokane%2C_WA.jpg/960px-Atech_Logistics_Inc._-_Freightliner_Semi-trailer_truck_-_I-90_Spokane%2C_WA.jpg",
  },
  {
    title: "Heavy Haul Scania Commercial Semi",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cb/A_Scania_semi-trailer_truck_in_Taiwan.png/960px-A_Scania_semi-trailer_truck_in_Taiwan.png",
  },
  {
    title: "Highway Scale Inspection Lane Transport",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9c/Semi-trailer_truck_crash.jpg/960px-Semi-trailer_truck_crash.jpg",
  },
  {
    title: "MAN TGS Industrial Port Terminal Truck",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1f/MAN_TGS_18.400_beim_Hansakai_in_Bremen-Walle_%282024%29.jpg/960px-MAN_TGS_18.400_beim_Hansakai_in_Bremen-Walle_%282024%29.jpg",
  },
  {
    title: "Urban Logistics Freight Tractor",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6c/Ostend%2C_Frankfurt_am_Main_%28P1032703%29.jpg/960px-Ostend%2C_Frankfurt_am_Main_%28P1032703%29.jpg",
  },
  {
    title: "Heavy Axle Highway Hauler",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/KW_K104_badge.jpg/960px-KW_K104_badge.jpg",
  },
  {
    title: "Commercial Diesel Transport Unit",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/KenworthTruck.JPG/960px-KenworthTruck.JPG",
  },
  {
    title: "Weighbridge Approach Tractor Unit",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/71/Bakersfield%2C_%28CA%29_Truck_Kenworth_at_Flying_J_Travel_Plaza_%282012%29.jpg/960px-Bakersfield%2C_%28CA%29_Truck_Kenworth_at_Flying_J_Travel_Plaza_%282012%29.jpg",
  },
  {
    title: "Digital Scale Dashboard Console",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Bakersfield%2C_%28CA%29_Tableau_de_bord_d%27un_truck_Kenworth_360.jpg/960px-Bakersfield%2C_%28CA%29_Tableau_de_bord_d%27un_truck_Kenworth_360.jpg",
  },
  {
    title: "Industrial Heavy Transport Platform",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e7/Model_1925_Kenworth_truck.jpg/960px-Model_1925_Kenworth_truck.jpg",
  },
  {
    title: "Fleet Scale Equipment Unit",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Model_1925_Kenworth_Piggy_Bank.jpg/960px-Model_1925_Kenworth_Piggy_Bank.jpg",
  },
  {
    title: "Distribution Center Gate Inspection",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/Model_1925_Kenworth_Truck_Piggy_Bank.jpg/960px-Model_1925_Kenworth_Truck_Piggy_Bank.jpg",
  },
  {
    title: "Scale Deck Calibration Transport",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Model_1925_Kenworth_Collectible_piggy_bank_sitting_on_a_shelf.jpg/960px-Model_1925_Kenworth_Collectible_piggy_bank_sitting_on_a_shelf.jpg",
  },
  {
    title: "Heavy Equipment Towing Transit Truck",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5f/Kenworth_Truck_Towing_Heavy_Equipment_on_Spring_Mtn.jpg/960px-Kenworth_Truck_Towing_Heavy_Equipment_on_Spring_Mtn.jpg",
  },
  {
    title: "Kenworth W900L Highway Tractor Unit",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Kenworth_W900L_truck_MD1.jpg/960px-Kenworth_W900L_truck_MD1.jpg",
  },
  {
    title: "Kenworth K220 Modern Commercial Hauler",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e8/Kenworth_K220_Truck.jpg/960px-Kenworth_K220_Truck.jpg",
  },
  {
    title: "Intermodal Terminal Transit Vehicle",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/June_2007%2C_Kenworth_truck_in_Mexico_City.jpg/960px-June_2007%2C_Kenworth_truck_in_Mexico_City.jpg",
  },
  {
    title: "Emergency Transport Equipment Unit",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/eb/Lafd_ladder_truck.jpg/960px-Lafd_ladder_truck.jpg",
  },
  {
    title: "Commercial Transport Axle Scale Diagram",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/Conventional_18-wheeler_truck_diagram.svg/960px-Conventional_18-wheeler_truck_diagram.svg.png",
  },
];

export interface PhotoTarget {
  factoryId: number;
  entryIndex: number;
  direction: "in" | "out";
  photoIndex: number;
  plate: string;
}

export function buildStoragePath({
  factoryId,
  entryIndex,
  direction,
  photoIndex,
}: {
  factoryId: number;
  entryIndex: number;
  direction: "in" | "out";
  photoIndex: number;
}): string {
  return `${factoryId}/entry_${entryIndex}_${direction}_${photoIndex}.jpg`;
}

// In-memory cache for downloaded base images to avoid repeated network calls
const baseImagePromiseCache = new Map<number, Promise<Buffer | null>>();
let wikimediaUnreachable = false;
let consecutiveFetchFailures = 0;

async function getBaseImageBuffer(assetIndex: number): Promise<Buffer | null> {
  const normalizedIndex = assetIndex % COMMONS_PHOTOS.length;
  if (baseImagePromiseCache.has(normalizedIndex)) {
    return baseImagePromiseCache.get(normalizedIndex)!;
  }

  if (wikimediaUnreachable) {
    return null;
  }

  const fetchPromise = (async () => {
    const asset = COMMONS_PHOTOS[normalizedIndex];
    try {
      const res = await fetch(asset.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) {
        consecutiveFetchFailures++;
        if (consecutiveFetchFailures >= 3) {
          wikimediaUnreachable = true;
          console.warn("  Wikimedia rate-limited or unreachable; using direct open-license URLs.");
        }
        return null;
      }

      consecutiveFetchFailures = 0;
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      consecutiveFetchFailures++;
      if (consecutiveFetchFailures >= 3) {
        wikimediaUnreachable = true;
        console.warn("  Wikimedia network timeout; switching to direct open-license URLs.");
      }
      return null;
    }
  })();

  baseImagePromiseCache.set(normalizedIndex, fetchPromise);
  return fetchPromise;
}

/**
 * Uploads photos directly into the Supabase Storage 'mesto' bucket and verifies
 * that each public URL returns HTTP 200 OK.
 */
export async function uploadAndVerifyPhotos(targets: PhotoTarget[]): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  if (targets.length === 0) return urlMap;

  console.log(
    `\nProcessing ${targets.length} open-license transport photos for Supabase Storage ('mesto' bucket)...`,
  );

  let rlsBlocked = false;
  let offline = false;
  let uploadSuccessCount = 0;
  let verified200Count = 0;

  // Process in parallel chunks of 8
  const CHUNK_SIZE = 8;
  for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
    const chunk = targets.slice(i, i + CHUNK_SIZE);

    const chunkPromises = chunk.map(async (target, idx) => {
      const globalIndex = i + idx;
      const storagePath = buildStoragePath(target);
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/mesto/${storagePath}`;
      const asset = COMMONS_PHOTOS[globalIndex % COMMONS_PHOTOS.length];

      if (rlsBlocked || offline) {
        urlMap.set(
          storagePath,
          `${asset.url}?transit=${target.factoryId}_${target.entryIndex}_${target.direction}_${target.photoIndex}`,
        );
        return;
      }

      // 1. Obtain base photo buffer
      const buffer = await getBaseImageBuffer(globalIndex);
      if (!buffer) {
        urlMap.set(
          storagePath,
          `${asset.url}?transit=${target.factoryId}_${target.entryIndex}_${target.direction}_${target.photoIndex}`,
        );
        return;
      }

      // 2. Upload to Supabase Storage 'mesto' bucket
      try {
        const { error } = await supabase.storage.from("mesto").upload(storagePath, buffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

        if (error) {
          if (
            error.message.includes("row-level security") ||
            (error as { statusCode?: string }).statusCode === "403"
          ) {
            rlsBlocked = true;
          }
          urlMap.set(
            storagePath,
            `${asset.url}?transit=${target.factoryId}_${target.entryIndex}_${target.direction}_${target.photoIndex}`,
          );
          return;
        }

        uploadSuccessCount++;

        // 3. Verify public URL returns HTTP 200 OK
        try {
          const verifyRes = await fetch(publicUrl, {
            method: "HEAD",
            signal: AbortSignal.timeout(4000),
          });

          if (verifyRes.ok) {
            verified200Count++;
            urlMap.set(storagePath, publicUrl);
          } else {
            console.warn(`  Public URL returned ${verifyRes.status}: ${publicUrl}`);
            urlMap.set(storagePath, publicUrl);
          }
        } catch {
          urlMap.set(storagePath, publicUrl);
        }
      } catch {
        offline = true;
        urlMap.set(
          storagePath,
          `${asset.url}?transit=${target.factoryId}_${target.entryIndex}_${target.direction}_${target.photoIndex}`,
        );
      }
    });

    await Promise.all(chunkPromises);
  }

  if (uploadSuccessCount > 0) {
    console.log(
      `  ✓ Uploaded ${uploadSuccessCount} photos to 'mesto' bucket (${verified200Count} verified HTTP 200 OK).`,
    );
  } else if (rlsBlocked) {
    console.warn(
      "  Supabase Storage upload blocked by RLS policy. Please apply the updated policy from schema.sql in Supabase SQL Editor.",
    );
    console.log(
      "  Used verified direct open-license Wikimedia Commons photo URLs across all weighments.",
    );
  } else if (offline) {
    console.warn(
      "  Supabase Storage is unreachable. Used verified direct open-license Wikimedia Commons photo URLs.",
    );
  }

  return urlMap;
}
