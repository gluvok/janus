/**
 * @file scripts/test-seed.ts
 * @description High-volume database seed script strictly adhering to schema.sql and AGENTS.md.
 * Seeds test datasets partitioned by factory with full enum coverage and zero N+1 queries:
 * - Factories (Mesto Industrial Alpha, Apex Agro Logistics)
 * - Users with all 4 role_enum variants (admin, manager, operator, base)
 * - Centers with dedicated API keys partitioned by factory
 * - Automatic weighments generating all 4 weighment_type variants (in, out, pending, unassigned) + ANPR OCR anomalies
 * - Manual weighments generating all 4 weighment_type variants with operator attribution
 * - Support tickets covering all 3 ticket_status variants (approved, pending, rejected)
 */

import crypto from "node:crypto";
import argon2 from "argon2";
import { SUPABASE_URL, supabase } from "./supabase.ts";

const TABLES_IN_CLEAR_ORDER = [
  "tickets",
  "automatic_weighments",
  "manual_weighments",
  "sessions",
  "centers",
  "users",
  "factories",
] as const;

function daysAgo(days: number, minutesOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setMinutes(d.getMinutes() - minutesOffset);
  return d.toISOString();
}

async function clearDatabase() {
  console.log("🧹 [Clean Mode] Clearing all existing records in topological dependency order...");

  for (const table of TABLES_IN_CLEAR_ORDER) {
    const { error } = await supabase.from(table).delete().neq("id", 0);
    if (error) {
      throw new Error(`Failed to clear table '${table}': ${error.message}`);
    }
    console.log(`  ✓ Cleared table: ${table}`);
  }

  const { error: resetErr } = await supabase.rpc("reset_all_sequences");
  if (resetErr) {
    console.warn("  ⚠️ Could not invoke reset_all_sequences RPC:", resetErr.message);
  } else {
    console.log("  ✓ Reset all auto-increment sequences via reset_all_sequences().");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const shouldClean =
    args.includes("--clean") || args.includes("--reset") || process.env.RESET === "true";

  console.log("=================================================");
  console.log("🚀 Starting Mesto High-Volume Test Database Seeding");
  console.log(`📡 Supabase Endpoint: ${SUPABASE_URL}`);
  console.log("=================================================");

  if (shouldClean) {
    await clearDatabase();
  }

  // 1. FACTORIES (Batch Inspection & Creation - 0 N+1)
  console.log("\n🏭 [1/5] Ensuring Core Factories...");
  const factoryConfigs = [
    { name: "Mesto Industrial Alpha", receipt_images_per_row: 3 },
    { name: "Apex Agro Logistics", receipt_images_per_row: 4 },
  ];

  const targetFactoryNames = factoryConfigs.map((f) => f.name);
  const { data: existingFactories, error: existingFactoriesErr } = await supabase
    .from("factories")
    .select("id, name")
    .in("name", targetFactoryNames);

  if (existingFactoriesErr) throw existingFactoriesErr;

  const factoryMap = new Map<string, number>();
  for (const f of existingFactories ?? []) {
    factoryMap.set(f.name, f.id);
  }

  const missingFactories = factoryConfigs.filter((f) => !factoryMap.has(f.name));
  if (missingFactories.length > 0) {
    const { data: createdFactories, error: insertFactoriesErr } = await supabase
      .from("factories")
      .insert(missingFactories)
      .select("id, name");

    if (insertFactoriesErr || !createdFactories) throw insertFactoriesErr;
    for (const f of createdFactories) {
      factoryMap.set(f.name, f.id);
    }
  }

  const primaryFactoryId = factoryMap.get("Mesto Industrial Alpha")!;
  const secondaryFactoryId = factoryMap.get("Apex Agro Logistics")!;
  console.log(`  ✓ Factories ready (Alpha: ${primaryFactoryId}, Apex: ${secondaryFactoryId})`);

  // 2. USERS (Full coverage of role_enum: admin, manager, operator, base - 0 N+1)
  console.log("\n👥 [2/5] Seeding Users with all role_enum variants...");
  const [adminHash, managerHash, operatorHash, baseHash] = await Promise.all([
    argon2.hash("admin123"),
    argon2.hash("manager123"),
    argon2.hash("operator123"),
    argon2.hash("base123"),
  ]);

  const userConfigs = [
    // Factory 1 Users (Alpha)
    {
      username: "admin1",
      name: "System Administrator",
      role: "admin" as const,
      password_hash: adminHash,
      factory_id: primaryFactoryId,
    },
    {
      username: "manager1",
      name: "Operations Manager Alpha",
      role: "manager" as const,
      password_hash: managerHash,
      factory_id: primaryFactoryId,
    },
    {
      username: "operator1",
      name: "Main Scale Operator Alpha",
      role: "operator" as const,
      password_hash: operatorHash,
      factory_id: primaryFactoryId,
    },
    {
      username: "operator2",
      name: "Inbound Gate Operator Alpha",
      role: "operator" as const,
      password_hash: operatorHash,
      factory_id: primaryFactoryId,
    },
    {
      username: "base1",
      name: "Floor Associate Alpha",
      role: "base" as const,
      password_hash: baseHash,
      factory_id: primaryFactoryId,
    },
    // Factory 2 Users (Apex)
    {
      username: "admin2",
      name: "Admin Apex Logistics",
      role: "admin" as const,
      password_hash: adminHash,
      factory_id: secondaryFactoryId,
    },
    {
      username: "manager2",
      name: "Apex Logistics Manager",
      role: "manager" as const,
      password_hash: managerHash,
      factory_id: secondaryFactoryId,
    },
    {
      username: "operatorApex1",
      name: "Apex Gate Operator",
      role: "operator" as const,
      password_hash: operatorHash,
      factory_id: secondaryFactoryId,
    },
    {
      username: "base2",
      name: "Floor Associate Apex",
      role: "base" as const,
      password_hash: baseHash,
      factory_id: secondaryFactoryId,
    },
  ];

  const targetUsernames = userConfigs.map((u) => u.username);
  const { data: existingUsers, error: existingUsersErr } = await supabase
    .from("users")
    .select("id, username")
    .in("username", targetUsernames);

  if (existingUsersErr) throw existingUsersErr;

  const userMap = new Map<string, number>();
  for (const u of existingUsers ?? []) {
    userMap.set(u.username, u.id);
  }

  const missingUsers = userConfigs.filter((u) => !userMap.has(u.username));
  if (missingUsers.length > 0) {
    const { data: createdUsers, error: insertUsersErr } = await supabase
      .from("users")
      .insert(missingUsers)
      .select("id, username");

    if (insertUsersErr || !createdUsers) throw insertUsersErr;
    for (const u of createdUsers) {
      userMap.set(u.username, u.id);
    }
  }

  console.log(`  ✓ Users ready: ${userMap.size} users across 4 roles.`);

  // 3. CENTERS WITH API KEYS (Partitioned by factory - 0 N+1)
  console.log("\n⚖️ [3/5] Seeding Centers strictly partitioned by factory...");
  const centerConfigs = [
    { name: "North Weighbridge", factory_id: primaryFactoryId },
    { name: "South Inbound Scale", factory_id: primaryFactoryId },
    { name: "East Gate Outbound", factory_id: primaryFactoryId },
    { name: "Terminal 1 Bulk Scale", factory_id: primaryFactoryId },
    { name: "Terminal 2 Silo Platform", factory_id: primaryFactoryId },
    { name: "Apex Central Scale", factory_id: secondaryFactoryId },
    { name: "Apex Dockside Weighbridge", factory_id: secondaryFactoryId },
    { name: "Apex West Gate", factory_id: secondaryFactoryId },
  ];

  const targetCenterNames = centerConfigs.map((c) => c.name);
  const { data: existingCenters, error: existingCentersErr } = await supabase
    .from("centers")
    .select("id, name, factory_id")
    .in("name", targetCenterNames);

  if (existingCentersErr) throw existingCentersErr;

  const centerMap = new Map<string, number>();
  for (const c of existingCenters ?? []) {
    centerMap.set(`${c.factory_id}:${c.name}`, c.id);
  }

  const missingCenters = centerConfigs
    .filter((c) => !centerMap.has(`${c.factory_id}:${c.name}`))
    .map((c) => ({
      name: c.name,
      factory_id: c.factory_id,
      api_key: crypto.randomBytes(16).toString("hex"),
    }));

  if (missingCenters.length > 0) {
    const { data: createdCenters, error: insertCentersErr } = await supabase
      .from("centers")
      .insert(missingCenters)
      .select("id, name, factory_id");

    if (insertCentersErr || !createdCenters) throw insertCentersErr;
    for (const c of createdCenters) {
      centerMap.set(`${c.factory_id}:${c.name}`, c.id);
    }
  }

  const primaryCenterIds = [
    centerMap.get(`${primaryFactoryId}:North Weighbridge`)!,
    centerMap.get(`${primaryFactoryId}:South Inbound Scale`)!,
    centerMap.get(`${primaryFactoryId}:East Gate Outbound`)!,
    centerMap.get(`${primaryFactoryId}:Terminal 1 Bulk Scale`)!,
    centerMap.get(`${primaryFactoryId}:Terminal 2 Silo Platform`)!,
  ];

  const secondaryCenterIds = [
    centerMap.get(`${secondaryFactoryId}:Apex Central Scale`)!,
    centerMap.get(`${secondaryFactoryId}:Apex Dockside Weighbridge`)!,
    centerMap.get(`${secondaryFactoryId}:Apex West Gate`)!,
  ];

  console.log(
    `  ✓ Centers ready: ${primaryCenterIds.length} for Alpha, ${secondaryCenterIds.length} for Apex.`,
  );

  // 4. WEIGHMENTS DATA GENERATION (Full coverage of generated weighment_type)
  console.log(
    "\n🚛 [4/5] Seeding Tenant-Isolated Weighments covering all 4 weighment_type outcomes...",
  );

  const samplePlates = [
    "MH12AB1234",
    "MH14CD5678",
    "KA01EF9012",
    "KA05GH3456",
    "DL01AB9999",
    "HR26BC1111",
    "GJ01XY4444",
    "UP32AB7777",
    "TN09PQ3333",
    "WB19JK8888",
    "RJ14MN5555",
    "MP09ST2222",
  ];

  const sampleImages = [
    `${SUPABASE_URL}/storage/v1/object/public/mesto/1/weighment_truck_front.jpg`,
    `${SUPABASE_URL}/storage/v1/object/public/mesto/1/weighment_scale_platform.jpg`,
    "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=800&q=80",
  ];

  // 4A. Automatic Weighments: Realistic enum generation
  // Pattern over index modulo:
  // 0 -> 'pending' (out_weight is null)
  // 1 -> 'in' (in_weight > out_weight: delivery unloading)
  // 2 -> 'out' (in_weight < out_weight: loading goods)
  // 3 -> 'unassigned' (in_weight === out_weight: empty pass-through)
  // 4 -> 'in' with simulated ANPR OCR discrepancy
  const autoWeighments = [];

  // Factory 1 Auto Weighments (30 records)
  for (let i = 0; i < 30; i++) {
    const plate = samplePlates[i % samplePlates.length];
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
      // 'pending': vehicle still inside
      outWeight = null;
      outDetected = null;
    } else if (category === 1) {
      // 'in': vehicle unloaded cargo (in_weight > out_weight)
      outWeight = inWeight - 12000 - ((i * 190) % 4000);
    } else if (category === 2) {
      // 'out': vehicle loaded cargo (in_weight < out_weight)
      outWeight = inWeight + 11000 + ((i * 210) % 5000);
    } else if (category === 3) {
      // 'unassigned': tare equals gross
      outWeight = inWeight;
    } else {
      // category === 4: 'in' with simulated OCR discrepancy
      outWeight = inWeight - 10000;
      inDetected = plate.slice(0, -1) + (plate.endsWith("4") ? "A" : "B"); // Simulated camera misread
    }

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
      images: sampleImages,
      created_at: inTime,
      updated_at: outTime ?? inTime,
    });
  }

  // Factory 2 Auto Weighments (10 records)
  for (let i = 0; i < 10; i++) {
    const plate = samplePlates[(i + 6) % samplePlates.length];
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
      images: sampleImages,
      created_at: inTime,
      updated_at: outTime ?? inTime,
    });
  }

  const { data: createdAuto, error: autoErr } = await supabase
    .from("automatic_weighments")
    .insert(autoWeighments)
    .select("id, vehicle_number, in_detected_vehicle_number");

  if (autoErr || !createdAuto) throw autoErr;
  console.log(
    `  ✓ Seeded ${createdAuto.length} automatic weighments covering in/out/pending/unassigned.`,
  );

  // 4B. Manual Weighments (20 for Factory 1, 10 for Factory 2)
  const operatorId1 = userMap.get("operator1")!;
  const operatorId2 = userMap.get("operator2")!;
  const operatorApexId = userMap.get("operatorApex1")!;

  const manualWeighments = [];

  // Factory 1 Manual Weighments
  for (let i = 0; i < 20; i++) {
    const plate = samplePlates[(i + 3) % samplePlates.length];
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
      images: sampleImages.slice(0, 1),
      created_at: inTime,
      updated_at: outTime ?? inTime,
    });
  }

  // Factory 2 Manual Weighments
  for (let i = 0; i < 10; i++) {
    const plate = samplePlates[(i + 5) % samplePlates.length];
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
      images: sampleImages.slice(0, 1),
      created_at: inTime,
      updated_at: outTime ?? inTime,
    });
  }

  const { data: createdManual, error: manualErr } = await supabase
    .from("manual_weighments")
    .insert(manualWeighments)
    .select("id");

  if (manualErr || !createdManual) throw manualErr;
  console.log(`  ✓ Seeded ${createdManual.length} manual weighments with operator attribution.`);

  // 5. TICKETS LINKED TO AUTOMATIC WEIGHMENTS (Full ticket_status coverage - 0 N+1)
  console.log("\n🎫 [5/5] Seeding Support Tickets across all ticket_status variants...");

  // Find automatic weighments with OCR discrepancy or pending transit
  const ocrMismatchWeighment =
    createdAuto.find(
      (w) => w.in_detected_vehicle_number && w.in_detected_vehicle_number !== w.vehicle_number,
    ) ?? createdAuto[4];

  const ticketConfigs = [
    // Factory 1 approved ticket linked to OCR mismatch
    {
      concern: `Camera OCR misread plate as '${ocrMismatchWeighment.in_detected_vehicle_number}' on inbound scale.`,
      reply: `Plate verified manually as '${ocrMismatchWeighment.vehicle_number}' by gate operator.`,
      status: "approved" as const,
      automatic_weighment_id: ocrMismatchWeighment.id,
      user_id: operatorId1,
    },
    // Factory 1 approved ticket 2
    {
      concern: "Gross weight fluctuation detected during high wind conditions on platform.",
      reply: "Axle load re-weighed on auxiliary platform.",
      status: "approved" as const,
      automatic_weighment_id: createdAuto[1].id,
      user_id: operatorId2,
    },
    // Factory 1 pending ticket
    {
      concern: "Unmatched outbound weighment query awaiting driver delivery invoice.",
      reply: null,
      status: "pending" as const,
      automatic_weighment_id: createdAuto[0].id,
      user_id: operatorId1,
    },
    // Factory 2 rejected ticket
    {
      concern: "Request to void completed weighment ticket due to incorrect driver tare claim.",
      reply: "Rejected. Delivery invoice has already been issued and recorded in ERP.",
      status: "rejected" as const,
      automatic_weighment_id: createdAuto[30].id, // Factory 2 weighment
      user_id: operatorApexId,
    },
  ];

  const { data: createdTickets, error: ticketErr } = await supabase
    .from("tickets")
    .insert(ticketConfigs)
    .select("id");

  if (ticketErr || !createdTickets) throw ticketErr;
  console.log(`  ✓ Seeded ${createdTickets.length} tickets (approved, pending, rejected).`);

  console.log("\n=================================================");
  console.log("🎉 Test database seeding complete with zero schema errors!");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("❌ Test seeding failed:", err);
  process.exit(1);
});
