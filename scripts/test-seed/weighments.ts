/**
 * @file scripts/test-seed/weighments.ts
 * @description Generates automatic and manual weighments with verified open-license photos in Supabase Storage.
 */

import { supabase } from "../supabase.ts";
import { SAMPLE_PLATES, daysAgo } from "./constants.ts";
import { buildStoragePath, uploadAndVerifyPhotos, type PhotoTarget } from "./photos.ts";
import type { SeedContext } from "./types.ts";

export async function seedWeighments(ctx: SeedContext): Promise<{
  createdAuto: Array<{
    id: number;
    vehicle_number: string;
    in_detected_vehicle_number: string | null;
  }>;
  createdManual: Array<{ id: number }>;
}> {
  console.log(
    "\n🚛 [4/5] Seeding Tenant-Isolated Weighments covering all 4 weighment_type outcomes...",
  );

  const { primaryFactoryId, secondaryFactoryId, userMap, primaryCenterIds, secondaryCenterIds } =
    ctx;

  const photoTargets: PhotoTarget[] = [];

  function registerPhoto(target: PhotoTarget): string {
    photoTargets.push(target);
    return buildStoragePath(target);
  }

  interface WeighmentSpec {
    vehicle_number: string;
    in_detected_vehicle_number: string | null;
    out_detected_vehicle_number: string | null;
    in_weight: number;
    out_weight: number | null;
    in_time: string;
    out_time: string | null;
    in_center_id: number;
    out_center_id: number | null;
    in_creator_id?: number;
    out_creator_id?: number | null;
    inPhotoPaths: string[];
    outPhotoPaths: string[];
    created_at: string;
    updated_at: string;
  }

  const autoSpecs: WeighmentSpec[] = [];
  const manualSpecs: WeighmentSpec[] = [];

  // Factory 1 Auto Weighments (30 records)
  for (let i = 0; i < 30; i++) {
    const plate = SAMPLE_PLATES[i % SAMPLE_PLATES.length];
    const category = i % 5;
    const inCenterId = primaryCenterIds[i % primaryCenterIds.length];
    const outCenterId = category !== 0 ? primaryCenterIds[(i + 1) % primaryCenterIds.length] : null;

    const inTime = daysAgo(Math.floor(i / 3), (i % 24) * 20);
    const outTime = category !== 0 ? daysAgo(Math.floor(i / 3), (i % 24) * 20 - 45) : null;

    let inWeight = 25000 + ((i * 370) % 15000);
    let outWeight: number | null = null;
    let inDetected: string | null = plate;
    let outDetected: string | null = plate;

    if (category === 0) {
      outWeight = null;
      outDetected = null;
    } else if (category === 1) {
      outWeight = inWeight - 12000 - ((i * 190) % 4000);
    } else if (category === 2) {
      outWeight = inWeight + 11000 + ((i * 210) % 5000);
    } else if (category === 3) {
      outWeight = inWeight;
    } else {
      outWeight = inWeight - 10000;
      inDetected = plate.slice(0, -1) + (plate.endsWith("4") ? "A" : "B");
    }

    const inCount = (i % 2) + 1;
    const inPhotoPaths = Array.from({ length: inCount }, (_, p) =>
      registerPhoto({
        factoryId: primaryFactoryId,
        mode: "auto",
        weighmentIndex: i,
        direction: "in",
        photoIndex: p,
        plate,
      }),
    );

    const outCount = category !== 0 ? ((i + 1) % 2) + 1 : 0;
    const outPhotoPaths =
      category !== 0
        ? Array.from({ length: outCount }, (_, p) =>
            registerPhoto({
              factoryId: primaryFactoryId,
              mode: "auto",
              weighmentIndex: i,
              direction: "out",
              photoIndex: p,
              plate,
            }),
          )
        : [];

    autoSpecs.push({
      vehicle_number: plate,
      in_detected_vehicle_number: inDetected,
      out_detected_vehicle_number: outDetected,
      in_weight: inWeight,
      out_weight: outWeight,
      in_time: inTime,
      out_time: outTime,
      in_center_id: inCenterId,
      out_center_id: outCenterId,
      inPhotoPaths,
      outPhotoPaths,
      created_at: inTime,
      updated_at: outTime ?? inTime,
    });
  }

  // Factory 2 Auto Weighments (10 records)
  for (let i = 0; i < 10; i++) {
    const plate = SAMPLE_PLATES[(i + 6) % SAMPLE_PLATES.length];
    const category = i % 4;
    const inCenterId = secondaryCenterIds[i % secondaryCenterIds.length];
    const outCenterId =
      category !== 0 ? secondaryCenterIds[(i + 1) % secondaryCenterIds.length] : null;

    const inTime = daysAgo(Math.floor(i / 2), (i % 18) * 25);
    const outTime = category !== 0 ? daysAgo(Math.floor(i / 2), (i % 18) * 25 - 40) : null;

    let inWeight = 22000 + ((i * 410) % 12000);
    let outWeight: number | null = null;

    if (category === 0) {
      outWeight = null;
    } else if (category === 1) {
      outWeight = inWeight - 9000;
    } else if (category === 2) {
      outWeight = inWeight + 8500;
    } else {
      outWeight = inWeight;
    }

    const inCount = (i % 2) + 1;
    const inPhotoPaths = Array.from({ length: inCount }, (_, p) =>
      registerPhoto({
        factoryId: secondaryFactoryId,
        mode: "auto",
        weighmentIndex: i + 30,
        direction: "in",
        photoIndex: p,
        plate,
      }),
    );

    const outCount = category !== 0 ? (i % 2) + 1 : 0;
    const outPhotoPaths =
      category !== 0
        ? Array.from({ length: outCount }, (_, p) =>
            registerPhoto({
              factoryId: secondaryFactoryId,
              mode: "auto",
              weighmentIndex: i + 30,
              direction: "out",
              photoIndex: p,
              plate,
            }),
          )
        : [];

    autoSpecs.push({
      vehicle_number: plate,
      in_detected_vehicle_number: plate,
      out_detected_vehicle_number: category !== 0 ? plate : null,
      in_weight: inWeight,
      out_weight: outWeight,
      in_time: inTime,
      out_time: outTime,
      in_center_id: inCenterId,
      out_center_id: outCenterId,
      inPhotoPaths,
      outPhotoPaths,
      created_at: inTime,
      updated_at: outTime ?? inTime,
    });
  }

  // Operators for Manual Weighments
  const operatorId1 = userMap.get("operator1")!;
  const operatorId2 = userMap.get("operator2")!;
  const operatorApexId = userMap.get("operatorApex1")!;

  // Factory 1 Manual Weighments (20 records)
  for (let i = 0; i < 20; i++) {
    const plate = SAMPLE_PLATES[(i + 3) % SAMPLE_PLATES.length];
    const category = i % 4;
    const inCenterId = primaryCenterIds[i % primaryCenterIds.length];
    const outCenterId = category !== 0 ? primaryCenterIds[(i + 2) % primaryCenterIds.length] : null;

    const inTime = daysAgo(Math.floor(i / 2), (i % 12) * 35);
    const outTime = category !== 0 ? daysAgo(Math.floor(i / 2), (i % 12) * 35 - 50) : null;

    let inWeight = 18000 + ((i * 450) % 12000);
    let outWeight: number | null = null;

    if (category === 0) {
      outWeight = null;
    } else if (category === 1) {
      outWeight = inWeight - 8000;
    } else if (category === 2) {
      outWeight = inWeight + 9500;
    } else {
      outWeight = inWeight;
    }

    const inCount = (i % 2) + 1;
    const inPhotoPaths = Array.from({ length: inCount }, (_, p) =>
      registerPhoto({
        factoryId: primaryFactoryId,
        mode: "manual",
        weighmentIndex: i,
        direction: "in",
        photoIndex: p,
        plate,
      }),
    );

    const outPhotoPaths =
      category !== 0
        ? [
            registerPhoto({
              factoryId: primaryFactoryId,
              mode: "manual",
              weighmentIndex: i,
              direction: "out",
              photoIndex: 0,
              plate,
            }),
          ]
        : [];

    manualSpecs.push({
      vehicle_number: plate,
      in_detected_vehicle_number: null,
      out_detected_vehicle_number: null,
      in_weight: inWeight,
      out_weight: outWeight,
      in_time: inTime,
      out_time: outTime,
      in_center_id: inCenterId,
      out_center_id: outCenterId,
      in_creator_id: operatorId1,
      out_creator_id: category !== 0 ? operatorId2 : null,
      inPhotoPaths,
      outPhotoPaths,
      created_at: inTime,
      updated_at: outTime ?? inTime,
    });
  }

  // Factory 2 Manual Weighments (10 records)
  for (let i = 0; i < 10; i++) {
    const plate = SAMPLE_PLATES[(i + 5) % SAMPLE_PLATES.length];
    const category = i % 4;
    const inCenterId = secondaryCenterIds[i % secondaryCenterIds.length];
    const outCenterId =
      category !== 0 ? secondaryCenterIds[(i + 1) % secondaryCenterIds.length] : null;

    const inTime = daysAgo(Math.floor(i / 2), (i % 14) * 30);
    const outTime = category !== 0 ? daysAgo(Math.floor(i / 2), (i % 14) * 30 - 45) : null;

    let inWeight = 19000 + ((i * 380) % 11000);
    let outWeight: number | null = null;

    if (category === 0) {
      outWeight = null;
    } else if (category === 1) {
      outWeight = inWeight - 7500;
    } else if (category === 2) {
      outWeight = inWeight + 8500;
    } else {
      outWeight = inWeight;
    }

    const inPhotoPaths = [
      registerPhoto({
        factoryId: secondaryFactoryId,
        mode: "manual",
        weighmentIndex: i + 20,
        direction: "in",
        photoIndex: 0,
        plate,
      }),
    ];

    const outPhotoPaths =
      category !== 0
        ? [
            registerPhoto({
              factoryId: secondaryFactoryId,
              mode: "manual",
              weighmentIndex: i + 20,
              direction: "out",
              photoIndex: 0,
              plate,
            }),
          ]
        : [];

    manualSpecs.push({
      vehicle_number: plate,
      in_detected_vehicle_number: null,
      out_detected_vehicle_number: null,
      in_weight: inWeight,
      out_weight: outWeight,
      in_time: inTime,
      out_time: outTime,
      in_center_id: inCenterId,
      out_center_id: outCenterId,
      in_creator_id: operatorApexId,
      out_creator_id: category !== 0 ? operatorApexId : null,
      inPhotoPaths,
      outPhotoPaths,
      created_at: inTime,
      updated_at: outTime ?? inTime,
    });
  }

  // Upload or fallback all photos in parallel and verify live HTTP 200
  const resolvedPhotoUrls = await uploadAndVerifyPhotos(photoTargets);

  // Transform specs into final database insert records
  const autoWeighments = autoSpecs.map((spec) => ({
    vehicle_number: spec.vehicle_number,
    in_detected_vehicle_number: spec.in_detected_vehicle_number,
    out_detected_vehicle_number: spec.out_detected_vehicle_number,
    in_weight: spec.in_weight,
    out_weight: spec.out_weight,
    in_time: spec.in_time,
    out_time: spec.out_time,
    in_center_id: spec.in_center_id,
    out_center_id: spec.out_center_id,
    in_images: spec.inPhotoPaths.map((p) => resolvedPhotoUrls.get(p)!),
    out_images: spec.outPhotoPaths.map((p) => resolvedPhotoUrls.get(p)!),
    created_at: spec.created_at,
    updated_at: spec.updated_at,
  }));

  const manualWeighments = manualSpecs.map((spec) => ({
    vehicle_number: spec.vehicle_number,
    in_weight: spec.in_weight,
    out_weight: spec.out_weight,
    in_time: spec.in_time,
    out_time: spec.out_time,
    in_center_id: spec.in_center_id,
    out_center_id: spec.out_center_id,
    in_creator_id: spec.in_creator_id!,
    out_creator_id: spec.out_creator_id,
    in_images: spec.inPhotoPaths.map((p) => resolvedPhotoUrls.get(p)!),
    out_images: spec.outPhotoPaths.map((p) => resolvedPhotoUrls.get(p)!),
    created_at: spec.created_at,
    updated_at: spec.updated_at,
  }));

  // Verify 100% uniqueness of every seeded photo across all 70 weighments
  const allAssignedPhotos = new Set<string>();
  let duplicatePhotoCount = 0;
  for (const w of [...autoWeighments, ...manualWeighments]) {
    for (const url of [...w.in_images, ...w.out_images]) {
      if (allAssignedPhotos.has(url)) duplicatePhotoCount++;
      allAssignedPhotos.add(url);
    }
  }

  if (duplicatePhotoCount > 0) {
    throw new Error(`Duplicate photos detected: ${duplicatePhotoCount} duplicate URLs found!`);
  }
  console.log(
    `  ✓ Verified ${allAssignedPhotos.size} unique photos across 70 weighments (0 duplicates).`,
  );

  const { data: createdAuto, error: autoErr } = await supabase
    .from("automatic_weighments")
    .insert(autoWeighments)
    .select("id, vehicle_number, in_detected_vehicle_number");

  if (autoErr || !createdAuto) throw autoErr;
  console.log(
    `  ✓ Seeded ${createdAuto.length} automatic weighments covering in/out/pending/unassigned.`,
  );

  const { data: createdManual, error: manualErr } = await supabase
    .from("manual_weighments")
    .insert(manualWeighments)
    .select("id");

  if (manualErr || !createdManual) throw manualErr;
  console.log(`  ✓ Seeded ${createdManual.length} manual weighments with operator attribution.`);

  return { createdAuto, createdManual };
}
