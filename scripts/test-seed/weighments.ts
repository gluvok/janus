/**
 * @file scripts/test-seed/weighments.ts
 * @description Generates automatic and manual weighments with 100% valid, unique SVG photos.
 */

import { supabase } from "../supabase.ts";
import { SAMPLE_PLATES, daysAgo } from "./constants.ts";
import { buildUniquePhotoSvgUri } from "./photos.ts";
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

  const {
    primaryFactoryId,
    secondaryFactoryId,
    userMap,
    primaryCenterIds,
    secondaryCenterIds,
    centerNameMap,
  } = ctx;

  const autoWeighments = [];

  // Factory 1 Auto Weighments (30 records)
  for (let i = 0; i < 30; i++) {
    const plate = SAMPLE_PLATES[i % SAMPLE_PLATES.length];
    const category = i % 5;
    const inCenterId = primaryCenterIds[i % primaryCenterIds.length];
    const outCenterId = category !== 0 ? primaryCenterIds[(i + 1) % primaryCenterIds.length] : null;
    const inCenterName = centerNameMap.get(inCenterId) ?? "Primary Scale";
    const outCenterName = outCenterId ? (centerNameMap.get(outCenterId) ?? "Secondary Scale") : "";

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
    const inImages = Array.from({ length: inCount }, (_, p) =>
      buildUniquePhotoSvgUri({
        factoryId: primaryFactoryId,
        mode: "auto",
        weighmentIndex: i,
        direction: "in",
        photoIndex: p,
        plate,
        scaleName: inCenterName,
      }),
    );

    const outCount = category !== 0 ? ((i + 1) % 2) + 1 : 0;
    const outImages =
      category !== 0
        ? Array.from({ length: outCount }, (_, p) =>
            buildUniquePhotoSvgUri({
              factoryId: primaryFactoryId,
              mode: "auto",
              weighmentIndex: i,
              direction: "out",
              photoIndex: p,
              plate,
              scaleName: outCenterName,
            }),
          )
        : [];

    autoWeighments.push({
      vehicle_number: plate,
      in_detected_vehicle_number: inDetected,
      out_detected_vehicle_number: outDetected,
      in_weight: inWeight,
      out_weight: outWeight,
      in_time: inTime,
      out_time: outTime,
      in_center_id: inCenterId,
      out_center_id: outCenterId,
      in_images: inImages,
      out_images: outImages,
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
    const inCenterName = centerNameMap.get(inCenterId) ?? "Apex Inbound Scale";
    const outCenterName = outCenterId
      ? (centerNameMap.get(outCenterId) ?? "Apex Outbound Scale")
      : "";

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
    const inImages = Array.from({ length: inCount }, (_, p) =>
      buildUniquePhotoSvgUri({
        factoryId: secondaryFactoryId,
        mode: "auto",
        weighmentIndex: i + 30,
        direction: "in",
        photoIndex: p,
        plate,
        scaleName: inCenterName,
      }),
    );

    const outCount = category !== 0 ? (i % 2) + 1 : 0;
    const outImages =
      category !== 0
        ? Array.from({ length: outCount }, (_, p) =>
            buildUniquePhotoSvgUri({
              factoryId: secondaryFactoryId,
              mode: "auto",
              weighmentIndex: i + 30,
              direction: "out",
              photoIndex: p,
              plate,
              scaleName: outCenterName,
            }),
          )
        : [];

    autoWeighments.push({
      vehicle_number: plate,
      in_detected_vehicle_number: plate,
      out_detected_vehicle_number: category !== 0 ? plate : null,
      in_weight: inWeight,
      out_weight: outWeight,
      in_time: inTime,
      out_time: outTime,
      in_center_id: inCenterId,
      out_center_id: outCenterId,
      in_images: inImages,
      out_images: outImages,
      created_at: inTime,
      updated_at: outTime ?? inTime,
    });
  }

  // Manual Weighments
  const operatorId1 = userMap.get("operator1")!;
  const operatorId2 = userMap.get("operator2")!;
  const operatorApexId = userMap.get("operatorApex1")!;

  const manualWeighments = [];

  // Factory 1 Manual Weighments (20 records)
  for (let i = 0; i < 20; i++) {
    const plate = SAMPLE_PLATES[(i + 3) % SAMPLE_PLATES.length];
    const category = i % 4;
    const inCenterId = primaryCenterIds[i % primaryCenterIds.length];
    const outCenterId = category !== 0 ? primaryCenterIds[(i + 2) % primaryCenterIds.length] : null;
    const inCenterName = centerNameMap.get(inCenterId) ?? "Primary Scale";
    const outCenterName = outCenterId ? (centerNameMap.get(outCenterId) ?? "Secondary Scale") : "";

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
    const inImages = Array.from({ length: inCount }, (_, p) =>
      buildUniquePhotoSvgUri({
        factoryId: primaryFactoryId,
        mode: "manual",
        weighmentIndex: i,
        direction: "in",
        photoIndex: p,
        plate,
        scaleName: inCenterName,
      }),
    );

    const outImages =
      category !== 0
        ? [
            buildUniquePhotoSvgUri({
              factoryId: primaryFactoryId,
              mode: "manual",
              weighmentIndex: i,
              direction: "out",
              photoIndex: 0,
              plate,
              scaleName: outCenterName,
            }),
          ]
        : [];

    manualWeighments.push({
      vehicle_number: plate,
      in_weight: inWeight,
      out_weight: outWeight,
      in_time: inTime,
      out_time: outTime,
      in_center_id: inCenterId,
      out_center_id: outCenterId,
      in_creator_id: operatorId1,
      out_creator_id: category !== 0 ? operatorId2 : null,
      in_images: inImages,
      out_images: outImages,
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
    const inCenterName = centerNameMap.get(inCenterId) ?? "Apex Inbound Scale";
    const outCenterName = outCenterId
      ? (centerNameMap.get(outCenterId) ?? "Apex Outbound Scale")
      : "";

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

    const inImages = [
      buildUniquePhotoSvgUri({
        factoryId: secondaryFactoryId,
        mode: "manual",
        weighmentIndex: i + 20,
        direction: "in",
        photoIndex: 0,
        plate,
        scaleName: inCenterName,
      }),
    ];

    const outImages =
      category !== 0
        ? [
            buildUniquePhotoSvgUri({
              factoryId: secondaryFactoryId,
              mode: "manual",
              weighmentIndex: i + 20,
              direction: "out",
              photoIndex: 0,
              plate,
              scaleName: outCenterName,
            }),
          ]
        : [];

    manualWeighments.push({
      vehicle_number: plate,
      in_weight: inWeight,
      out_weight: outWeight,
      in_time: inTime,
      out_time: outTime,
      in_center_id: inCenterId,
      out_center_id: outCenterId,
      in_creator_id: operatorApexId,
      out_creator_id: category !== 0 ? operatorApexId : null,
      in_images: inImages,
      out_images: outImages,
      created_at: inTime,
      updated_at: outTime ?? inTime,
    });
  }

  // Verify 100% uniqueness of every seeded weighment photo
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
    `  ✓ Verified ${allAssignedPhotos.size} unique SVG photos across 70 weighments (0 duplicates).`,
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
