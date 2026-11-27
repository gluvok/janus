/**
 * @file scripts/test-seed/entries.ts
 * @description Generates tenant-isolated automatic and manual scale entries with verified open-license photos in Supabase Storage.
 */

import crypto from "node:crypto";
import { supabase } from "../supabase.ts";
import { SAMPLE_PLATES, daysAgo } from "./constants.ts";
import { buildStoragePath, uploadAndVerifyPhotos, type PhotoTarget } from "./photos.ts";
import type { SeedContext } from "./types.ts";

export interface SeededAutomaticEntry {
  id: number;
  center_id: number;
  vehicle_number: string;
  weight: number;
  images: string[];
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface SeededManualEntry {
  id: number;
  center_id: number;
  creator_id: number;
  vehicle_number: string;
  weight: number;
  images: string[];
  created_at: string;
  updated_at: string;
}

export interface EntryGroup<T> {
  pairedInEntries: T[];
  pairedOutEntries: T[];
  standaloneEntries: T[];
}

export interface SeededEntriesResult {
  automatic: EntryGroup<SeededAutomaticEntry>;
  manual: EntryGroup<SeededManualEntry>;
}

interface BaseEntrySpec {
  kind: "automatic" | "manual";
  center_id: number;
  creator_id?: number;
  vehicle_number: string;
  weight: number;
  photoPaths: string[];
  idempotency_key?: string;
  created_at: string;
  updated_at: string;
  role?: "pairedIn" | "pairedOut" | "standalone";
}

function getRequiredUserId(userMap: Map<string, number>, username: string): number {
  const id = userMap.get(username);
  if (id === undefined) {
    throw new Error(`Missing required seeded user '${username}' in userMap.`);
  }
  return id;
}

function pairOutWeight(inWeight: number, index: number, deltaIn: number, deltaOut: number): number {
  const scenario = index % 3;
  if (scenario === 0) return inWeight - deltaIn;
  if (scenario === 1) return inWeight + deltaOut;
  return inWeight;
}

function splitGroup<T>(specs: BaseEntrySpec[], rows: T[]): EntryGroup<T> {
  const pairedInEntries: T[] = [];
  const pairedOutEntries: T[] = [];
  const standaloneEntries: T[] = [];

  for (let i = 0; i < rows.length; i++) {
    const role = specs[i].role;
    if (role === "pairedIn") {
      pairedInEntries.push(rows[i]);
    } else if (role === "pairedOut") {
      pairedOutEntries.push(rows[i]);
    } else {
      standaloneEntries.push(rows[i]);
    }
  }

  return { pairedInEntries, pairedOutEntries, standaloneEntries };
}

export async function seedEntries(ctx: SeedContext): Promise<SeededEntriesResult> {
  console.log(
    "\n[4/6] Seeding Automatic & Manual Scale Entries with unique photos & idempotency keys...",
  );

  const { primaryFactoryId, secondaryFactoryId, userMap, primaryCenterIds, secondaryCenterIds } =
    ctx;

  const photoTargets: PhotoTarget[] = [];
  function registerPhoto(target: PhotoTarget): string {
    photoTargets.push(target);
    return buildStoragePath(target);
  }

  const operator1Id = getRequiredUserId(userMap, "operator1");
  const operator2Id = getRequiredUserId(userMap, "operator2");
  const operatorApexId = getRequiredUserId(userMap, "operatorApex1");

  const specs: BaseEntrySpec[] = [];
  let globalEntryIndex = 0;

  const nextPhotos = (factoryId: number, direction: "in" | "out", plate: string): string[] => {
    const idx = globalEntryIndex++;
    return Array.from({ length: 2 }, (_, p) =>
      registerPhoto({ factoryId, entryIndex: idx, direction, photoIndex: p, plate }),
    );
  };

  function addPairedAndStandalone(opts: {
    kind: "automatic" | "manual";
    factoryId: number;
    centerIds: number[];
    pairedCount: number;
    standaloneCount: number;
    plateOffset: number;
    baseInWeight: number;
    inCreatorId?: number;
    outCreatorId?: number;
  }) {
    for (let i = 0; i < opts.pairedCount; i++) {
      const plate = SAMPLE_PLATES[(i + opts.plateOffset) % SAMPLE_PLATES.length];
      const inCenterId = opts.centerIds[i % opts.centerIds.length];
      const outCenterId = opts.centerIds[(i + 1) % opts.centerIds.length];
      const inTime = daysAgo(Math.floor(i / 3), (i % 24) * 20);
      const outTime = daysAgo(Math.floor(i / 3), (i % 24) * 20 - 45);
      const inWeight = opts.baseInWeight + ((i * 370) % 15000);
      const outWeight = pairOutWeight(
        inWeight,
        i,
        10000 + ((i * 150) % 3000),
        9500 + ((i * 200) % 4000),
      );

      specs.push({
        kind: opts.kind,
        center_id: inCenterId,
        creator_id: opts.inCreatorId,
        vehicle_number: plate,
        weight: inWeight,
        photoPaths: nextPhotos(opts.factoryId, "in", plate),
        idempotency_key: opts.kind === "automatic" ? crypto.randomUUIDv7() : undefined,
        created_at: inTime,
        updated_at: inTime,
        role: "pairedIn",
      });

      specs.push({
        kind: opts.kind,
        center_id: outCenterId,
        creator_id: opts.outCreatorId,
        vehicle_number: plate,
        weight: outWeight,
        photoPaths: nextPhotos(opts.factoryId, "out", plate),
        idempotency_key: opts.kind === "automatic" ? crypto.randomUUIDv7() : undefined,
        created_at: outTime,
        updated_at: outTime,
        role: "pairedOut",
      });
    }

    for (let s = 0; s < opts.standaloneCount; s++) {
      const plate = SAMPLE_PLATES[(s + opts.plateOffset + 5) % SAMPLE_PLATES.length];
      const centerId = opts.centerIds[s % opts.centerIds.length];
      const time = daysAgo(s, s * 30 + 10);
      const weight = 20000 + ((s * 410) % 10000);

      specs.push({
        kind: opts.kind,
        center_id: centerId,
        creator_id: opts.inCreatorId,
        vehicle_number: plate,
        weight,
        photoPaths: nextPhotos(opts.factoryId, "in", plate),
        idempotency_key: opts.kind === "automatic" ? crypto.randomUUIDv7() : undefined,
        created_at: time,
        updated_at: time,
        role: "standalone",
      });
    }
  }

  // Automatic entries: Factory 1 (20 paired + 6 standalone) and Factory 2 (10 paired + 4 standalone)
  addPairedAndStandalone({
    kind: "automatic",
    factoryId: primaryFactoryId,
    centerIds: primaryCenterIds,
    pairedCount: 20,
    standaloneCount: 6,
    plateOffset: 0,
    baseInWeight: 25000,
  });
  addPairedAndStandalone({
    kind: "automatic",
    factoryId: secondaryFactoryId,
    centerIds: secondaryCenterIds,
    pairedCount: 10,
    standaloneCount: 4,
    plateOffset: 4,
    baseInWeight: 22000,
  });

  // Manual entries: Factory 1 (15 paired + 5 standalone) and Factory 2 (10 paired + 4 standalone)
  addPairedAndStandalone({
    kind: "manual",
    factoryId: primaryFactoryId,
    centerIds: primaryCenterIds,
    pairedCount: 15,
    standaloneCount: 5,
    plateOffset: 2,
    baseInWeight: 26000,
    inCreatorId: operator1Id,
    outCreatorId: operator2Id,
  });
  addPairedAndStandalone({
    kind: "manual",
    factoryId: secondaryFactoryId,
    centerIds: secondaryCenterIds,
    pairedCount: 10,
    standaloneCount: 4,
    plateOffset: 6,
    baseInWeight: 23000,
    inCreatorId: operatorApexId,
    outCreatorId: operatorApexId,
  });

  const resolvedPhotoUrls = await uploadAndVerifyPhotos(photoTargets);

  const autoSpecs = specs.filter((s) => s.kind === "automatic");
  const manualSpecs = specs.filter((s) => s.kind === "manual");

  const { data: createdAuto, error: autoErr } = await supabase
    .from("automatic_entries")
    .insert(
      autoSpecs.map((spec) => ({
        center_id: spec.center_id,
        vehicle_number: spec.vehicle_number,
        weight: spec.weight,
        images: spec.photoPaths.map((p) => resolvedPhotoUrls.get(p) ?? p),
        idempotency_key: spec.idempotency_key!,
        created_at: spec.created_at,
        updated_at: spec.updated_at,
      })),
    )
    .select(
      "id, center_id, vehicle_number, weight, images, idempotency_key, created_at, updated_at",
    );

  if (autoErr || !createdAuto) {
    throw new Error(`Failed to seed automatic_entries: ${autoErr?.message}`);
  }

  const { data: createdManual, error: manualErr } = await supabase
    .from("manual_entries")
    .insert(
      manualSpecs.map((spec) => ({
        center_id: spec.center_id,
        creator_id: spec.creator_id!,
        vehicle_number: spec.vehicle_number,
        weight: spec.weight,
        images: spec.photoPaths.map((p) => resolvedPhotoUrls.get(p) ?? p),
        created_at: spec.created_at,
        updated_at: spec.updated_at,
      })),
    )
    .select("id, center_id, creator_id, vehicle_number, weight, images, created_at, updated_at");

  if (manualErr || !createdManual) {
    throw new Error(`Failed to seed manual_entries: ${manualErr?.message}`);
  }

  console.log(
    `  ✓ Seeded ${createdAuto.length} automatic_entries and ${createdManual.length} manual_entries across both factories.`,
  );

  return {
    automatic: splitGroup(autoSpecs, createdAuto as SeededAutomaticEntry[]),
    manual: splitGroup(manualSpecs, createdManual as SeededManualEntry[]),
  };
}
