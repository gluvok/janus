/**
 * @file scripts/test-seed/entries.ts
 * @description Generates tenant-isolated scale entries with verified open-license photos in Supabase Storage.
 */

import crypto from "node:crypto";
import { supabase } from "../supabase.ts";
import { SAMPLE_PLATES, daysAgo } from "./constants.ts";
import { buildStoragePath, uploadAndVerifyPhotos, type PhotoTarget } from "./photos.ts";
import type { SeedContext } from "./types.ts";

export interface SeededEntry {
  id: number;
  center_id: number;
  creator_id: number | null;
  vehicle_number: string;
  weight: number;
  images: string[];
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface SeededEntriesResult {
  pairedInEntries: SeededEntry[];
  pairedOutEntries: SeededEntry[];
  standaloneEntries: SeededEntry[];
}

export async function seedEntries(ctx: SeedContext): Promise<SeededEntriesResult> {
  console.log("\n⚖️ [4/6] Seeding Raw Scale Entries with unique photos & idempotency keys...");

  const { primaryFactoryId, secondaryFactoryId, userMap, primaryCenterIds, secondaryCenterIds } =
    ctx;

  const photoTargets: PhotoTarget[] = [];
  function registerPhoto(target: PhotoTarget): string {
    photoTargets.push(target);
    return buildStoragePath(target);
  }

  interface EntrySpec {
    center_id: number;
    creator_id: number | null;
    vehicle_number: string;
    weight: number;
    photoPaths: string[];
    idempotency_key: string;
    created_at: string;
    updated_at: string;
    isPairedIn?: boolean;
    isPairedOut?: boolean;
    pairIndex?: number;
  }

  const specs: EntrySpec[] = [];

  const operator1Id = userMap.get("operator1") ?? null;
  const operator2Id = userMap.get("operator2") ?? null;
  const operatorApexId = userMap.get("operatorApex1") ?? null;

  let globalEntryIndex = 0;

  // --- FACTORY 1 (Alpha): 30 Paired Cycles + 10 Standalone Entries ---
  for (let i = 0; i < 30; i++) {
    const plate = SAMPLE_PLATES[i % SAMPLE_PLATES.length];
    const inCenterId = primaryCenterIds[i % primaryCenterIds.length];
    const outCenterId = primaryCenterIds[(i + 1) % primaryCenterIds.length];

    const inTime = daysAgo(Math.floor(i / 3), (i % 24) * 20);
    const outTime = daysAgo(Math.floor(i / 3), (i % 24) * 20 - 45);

    const inWeight = 25000 + ((i * 370) % 15000);
    let outWeight: number;

    const scenario = i % 3;
    if (scenario === 0) {
      // Inbound delivery: in > out -> weighment type 'in'
      outWeight = inWeight - 10000 - ((i * 150) % 3000);
    } else if (scenario === 1) {
      // Outbound dispatch: in < out -> weighment type 'out'
      outWeight = inWeight + 9500 + ((i * 200) % 4000);
    } else {
      // Void pass-through: in == out -> weighment type 'void'
      outWeight = inWeight;
    }

    const inPhotoCount = 2;
    const inPhotoPaths = Array.from({ length: inPhotoCount }, (_, p) =>
      registerPhoto({
        factoryId: primaryFactoryId,
        entryIndex: globalEntryIndex,
        direction: "in",
        photoIndex: p,
        plate,
      }),
    );
    globalEntryIndex++;

    const outPhotoCount = 2;
    const outPhotoPaths = Array.from({ length: outPhotoCount }, (_, p) =>
      registerPhoto({
        factoryId: primaryFactoryId,
        entryIndex: globalEntryIndex,
        direction: "out",
        photoIndex: p,
        plate,
      }),
    );
    globalEntryIndex++;

    const inCreator = i % 2 === 0 ? operator1Id : null;
    const outCreator = i % 2 === 0 ? operator2Id : null;

    specs.push({
      center_id: inCenterId,
      creator_id: inCreator,
      vehicle_number: plate,
      weight: inWeight,
      photoPaths: inPhotoPaths,
      idempotency_key: crypto.randomUUIDv7(),
      created_at: inTime,
      updated_at: inTime,
      isPairedIn: true,
      pairIndex: i,
    });

    specs.push({
      center_id: outCenterId,
      creator_id: outCreator,
      vehicle_number: plate,
      weight: outWeight,
      photoPaths: outPhotoPaths,
      idempotency_key: crypto.randomUUIDv7(),
      created_at: outTime,
      updated_at: outTime,
      isPairedOut: true,
      pairIndex: i,
    });
  }

  // Factory 1 Standalone Entries (10 records)
  for (let s = 0; s < 10; s++) {
    const plate = SAMPLE_PLATES[(s + 7) % SAMPLE_PLATES.length];
    const centerId = primaryCenterIds[s % primaryCenterIds.length];
    const time = daysAgo(s, s * 30 + 10);
    const weight = 20000 + ((s * 410) % 10000);

    const photoPaths = Array.from({ length: 2 }, (_, p) =>
      registerPhoto({
        factoryId: primaryFactoryId,
        entryIndex: globalEntryIndex,
        direction: "in",
        photoIndex: p,
        plate,
      }),
    );
    globalEntryIndex++;

    specs.push({
      center_id: centerId,
      creator_id: s % 3 === 0 ? operator1Id : null,
      vehicle_number: plate,
      weight,
      photoPaths,
      idempotency_key: crypto.randomUUIDv7(),
      created_at: time,
      updated_at: time,
    });
  }

  // --- FACTORY 2 (Apex): 15 Paired Cycles + 5 Standalone Entries ---
  for (let i = 0; i < 15; i++) {
    const plate = SAMPLE_PLATES[(i + 4) % SAMPLE_PLATES.length];
    const inCenterId = secondaryCenterIds[i % secondaryCenterIds.length];
    const outCenterId = secondaryCenterIds[(i + 1) % secondaryCenterIds.length];

    const inTime = daysAgo(Math.floor(i / 2), (i % 18) * 25);
    const outTime = daysAgo(Math.floor(i / 2), (i % 18) * 25 - 40);

    const inWeight = 22000 + ((i * 320) % 11000);
    let outWeight: number;

    const scenario = i % 3;
    if (scenario === 0) {
      outWeight = inWeight - 8500;
    } else if (scenario === 1) {
      outWeight = inWeight + 9000;
    } else {
      outWeight = inWeight;
    }

    const inPhotoPaths = Array.from({ length: 2 }, (_, p) =>
      registerPhoto({
        factoryId: secondaryFactoryId,
        entryIndex: globalEntryIndex,
        direction: "in",
        photoIndex: p,
        plate,
      }),
    );
    globalEntryIndex++;

    const outPhotoPaths = Array.from({ length: 2 }, (_, p) =>
      registerPhoto({
        factoryId: secondaryFactoryId,
        entryIndex: globalEntryIndex,
        direction: "out",
        photoIndex: p,
        plate,
      }),
    );
    globalEntryIndex++;

    specs.push({
      center_id: inCenterId,
      creator_id: operatorApexId,
      vehicle_number: plate,
      weight: inWeight,
      photoPaths: inPhotoPaths,
      idempotency_key: crypto.randomUUIDv7(),
      created_at: inTime,
      updated_at: inTime,
      isPairedIn: true,
      pairIndex: i + 30,
    });

    specs.push({
      center_id: outCenterId,
      creator_id: operatorApexId,
      vehicle_number: plate,
      weight: outWeight,
      photoPaths: outPhotoPaths,
      idempotency_key: crypto.randomUUIDv7(),
      created_at: outTime,
      updated_at: outTime,
      isPairedOut: true,
      pairIndex: i + 30,
    });
  }

  // Factory 2 Standalone Entries (5 records)
  for (let s = 0; s < 5; s++) {
    const plate = SAMPLE_PLATES[(s + 2) % SAMPLE_PLATES.length];
    const centerId = secondaryCenterIds[s % secondaryCenterIds.length];
    const time = daysAgo(s, s * 25 + 15);
    const weight = 21000 + ((s * 330) % 9000);

    const photoPaths = Array.from({ length: 2 }, (_, p) =>
      registerPhoto({
        factoryId: secondaryFactoryId,
        entryIndex: globalEntryIndex,
        direction: "in",
        photoIndex: p,
        plate,
      }),
    );
    globalEntryIndex++;

    specs.push({
      center_id: centerId,
      creator_id: operatorApexId,
      vehicle_number: plate,
      weight,
      photoPaths,
      idempotency_key: crypto.randomUUIDv7(),
      created_at: time,
      updated_at: time,
    });
  }

  // Upload or fallback all photos in parallel and verify live HTTP 200
  const resolvedPhotoUrls = await uploadAndVerifyPhotos(photoTargets);

  const entriesToInsert = specs.map((spec) => ({
    center_id: spec.center_id,
    creator_id: spec.creator_id,
    vehicle_number: spec.vehicle_number,
    weight: spec.weight,
    images: spec.photoPaths.map((p) => resolvedPhotoUrls.get(p) ?? p),
    idempotency_key: spec.idempotency_key,
    created_at: spec.created_at,
    updated_at: spec.updated_at,
  }));

  const { data: createdEntries, error: entriesErr } = await supabase
    .from("entries")
    .insert(entriesToInsert)
    .select(
      "id, center_id, creator_id, vehicle_number, weight, images, idempotency_key, created_at, updated_at",
    );

  if (entriesErr || !createdEntries) {
    throw new Error(`Failed to seed entries: ${entriesErr?.message}`);
  }

  console.log(`  ✓ Seeded ${createdEntries.length} scale entries across both factories.`);

  const pairedInEntries: SeededEntry[] = [];
  const pairedOutEntries: SeededEntry[] = [];
  const standaloneEntries: SeededEntry[] = [];

  for (let i = 0; i < createdEntries.length; i++) {
    const spec = specs[i];
    const entry = createdEntries[i] as SeededEntry;
    if (spec.isPairedIn) {
      pairedInEntries.push(entry);
    } else if (spec.isPairedOut) {
      pairedOutEntries.push(entry);
    } else {
      standaloneEntries.push(entry);
    }
  }

  return { pairedInEntries, pairedOutEntries, standaloneEntries };
}
