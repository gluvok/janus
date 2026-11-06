/**
 * @file scripts/test-seed.ts
 * @description High-volume database seed script strictly adhering to schema.sql.
 * Seeds test datasets partitioned by factory with full enum coverage:
 * - Factories (Mesto Industrial Alpha, Apex Agro Logistics)
 * - Users with all 4 roles (admin, manager, operator, base)
 * - Centers with dedicated API keys partitioned by factory
 * - Automatic weighments strictly tenant-isolated
 * - Manual weighments strictly tenant-isolated
 * - Support tickets with all 3 statuses (approved, pending, rejected)
 */

import crypto from "node:crypto";
import argon2 from "argon2";
import { supabase } from "./supabase.ts";

const TABLES_IN_CLEAR_ORDER = [
  "tickets",
  "automatic_weighments",
  "manual_weighments",
  "sessions",
  "centers",
  "users",
  "factories",
];

function daysAgo(days: number, minutesOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setMinutes(d.getMinutes() - minutesOffset);
  return d.toISOString();
}

async function clearDatabase() {
  console.log("🧹 [Clean Mode] Clearing all existing records from database...");

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
    console.log("  ✓ Reset all auto-increment sequences.");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const shouldClean =
    args.includes("--clean") || args.includes("--reset") || process.env.RESET === "true";

  console.log("=================================================");
  console.log("🚀 Starting Mesto High-Volume Test Database Seeding");
  console.log(`📡 Supabase Endpoint: ${process.env.SUPABASE_URL}`);
  console.log("=================================================");

  if (shouldClean) {
    await clearDatabase();
  }

  // 1. FACTORIES
  console.log("\n🏭 [1/5] Ensuring Core Factories...");
  const factoryConfigs = [
    { name: "Mesto Industrial Alpha", receiptImagesPerRow: 3 },
    { name: "Apex Agro Logistics", receiptImagesPerRow: 4 },
  ];

  const factoryMap = new Map<string, number>();
  for (const cfg of factoryConfigs) {
    const { data: existing } = await supabase
      .from("factories")
      .select("id, name")
      .eq("name", cfg.name)
      .maybeSingle();

    if (existing) {
      factoryMap.set(cfg.name, existing.id);
    } else {
      const { data: created, error } = await supabase
        .from("factories")
        .insert({ name: cfg.name, receipt_images_per_row: cfg.receiptImagesPerRow })
        .select("id, name")
        .single();
      if (error || !created) throw error;
      factoryMap.set(cfg.name, created.id);
    }
  }

  const primaryFactoryId = factoryMap.get("Mesto Industrial Alpha")!;
  const secondaryFactoryId = factoryMap.get("Apex Agro Logistics")!;
  console.log(`  ✓ Factories ready (Alpha: ${primaryFactoryId}, Apex: ${secondaryFactoryId})`);

  // 2. USERS (Full coverage of role_enum: admin, manager, operator, base)
  console.log("\n👥 [2/5] Seeding Users with all role_enum variants...");
  const adminHash = await argon2.hash("admin123");
  const managerHash = await argon2.hash("manager123");
  const operatorHash = await argon2.hash("operator123");
  const baseHash = await argon2.hash("base123");

  const userConfigs = [
    // Factory 1 Users
    {
      username: "admin1",
      name: "System Administrator",
      role: "admin",
      passwordHash: adminHash,
      factoryId: primaryFactoryId,
    },
    {
      username: "manager1",
      name: "Operations Manager 1",
      role: "manager",
      passwordHash: managerHash,
      factoryId: primaryFactoryId,
    },
    {
      username: "operator1",
      name: "Main Scale Operator",
      role: "operator",
      passwordHash: operatorHash,
      factoryId: primaryFactoryId,
    },
    {
      username: "operator2",
      name: "Inbound Gate Operator",
      role: "operator",
      passwordHash: operatorHash,
      factoryId: primaryFactoryId,
    },
    {
      username: "base1",
      name: "Floor Associate Alpha",
      role: "base",
      passwordHash: baseHash,
      factoryId: primaryFactoryId,
    },
    // Factory 2 Users
    {
      username: "admin2",
      name: "Admin Apex Logistics",
      role: "admin",
      passwordHash: adminHash,
      factoryId: secondaryFactoryId,
    },
    {
      username: "manager2",
      name: "Apex Logistics Manager",
      role: "manager",
      passwordHash: managerHash,
      factoryId: secondaryFactoryId,
    },
    {
      username: "operatorApex1",
      name: "Apex Gate Operator",
      role: "operator",
      passwordHash: operatorHash,
      factoryId: secondaryFactoryId,
    },
    {
      username: "base2",
      name: "Floor Associate Apex",
      role: "base",
      passwordHash: baseHash,
      factoryId: secondaryFactoryId,
    },
  ];

  const userMap = new Map<string, number>();
  for (const u of userConfigs) {
    const { data: existing } = await supabase
      .from("users")
      .select("id, username")
      .eq("username", u.username)
      .maybeSingle();

    if (existing) {
      userMap.set(u.username, existing.id);
    } else {
      const { data: created, error } = await supabase
        .from("users")
        .insert({
          username: u.username,
          name: u.name,
          role: u.role,
          password_hash: u.passwordHash,
          factory_id: u.factoryId,
        })
        .select("id, username")
        .single();
      if (error || !created) throw error;
      userMap.set(u.username, created.id);
    }
  }
  console.log(`  ✓ Users ready: ${userMap.size} users across 4 roles.`);

  // 3. CENTERS WITH API KEYS (Strictly partitioned by factory)
  console.log("\n⚖️ [3/5] Seeding Centers strictly partitioned by factory...");
  const primaryCenterNames = [
    "North Weighbridge",
    "South Inbound Scale",
    "East Gate Outbound",
    "Terminal 1 Bulk Scale",
    "Terminal 2 Silo Platform",
  ];

  const secondaryCenterNames = [
    "Apex Central Scale",
    "Apex Dockside Weighbridge",
    "Apex West Gate",
  ];

  const primaryCenterIds: number[] = [];
  for (const name of primaryCenterNames) {
    const { data: existing } = await supabase
      .from("centers")
      .select("id, name")
      .eq("factory_id", primaryFactoryId)
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      primaryCenterIds.push(existing.id);
    } else {
      const apiKey = crypto.randomBytes(16).toString("hex");
      const { data: created, error } = await supabase
        .from("centers")
        .insert({ name, factory_id: primaryFactoryId, api_key: apiKey })
        .select("id")
        .single();
      if (error || !created) throw error;
      primaryCenterIds.push(created.id);
    }
  }

  const secondaryCenterIds: number[] = [];
  for (const name of secondaryCenterNames) {
    const { data: existing } = await supabase
      .from("centers")
      .select("id, name")
      .eq("factory_id", secondaryFactoryId)
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      secondaryCenterIds.push(existing.id);
    } else {
      const apiKey = crypto.randomBytes(16).toString("hex");
      const { data: created, error } = await supabase
        .from("centers")
        .insert({ name, factory_id: secondaryFactoryId, api_key: apiKey })
        .select("id")
        .single();
      if (error || !created) throw error;
      secondaryCenterIds.push(created.id);
    }
  }

  console.log(
    `  ✓ Centers ready: ${primaryCenterIds.length} for Alpha, ${secondaryCenterIds.length} for Apex.`,
  );

  // 4. AUTOMATIC & MANUAL WEIGHMENTS (Tenant Isolated)
  console.log("\n🚛 [4/5] Seeding Tenant-Isolated Automatic and Manual Weighments...");
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
    "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=800&q=80",
  ];

  // 4A. Automatic Weighments (30 for Factory 1, 10 for Factory 2)
  const autoWeighments = [];

  // Factory 1 Auto Weighments
  for (let i = 0; i < 30; i++) {
    const plate = samplePlates[i % samplePlates.length];
    const isCompleted = i % 5 !== 0; // 80% completed
    const inWeight = 25000 + ((i * 370) % 15000);
    const outWeight = isCompleted ? inWeight - 12000 - ((i * 190) % 4000) : null;
    const inCenterId = primaryCenterIds[i % primaryCenterIds.length];
    const outCenterId = isCompleted ? primaryCenterIds[(i + 1) % primaryCenterIds.length] : null;
    const inTime = daysAgo(Math.floor(i / 3), (i % 24) * 20);
    const outTime = isCompleted ? daysAgo(Math.floor(i / 3), (i % 24) * 20 - 45) : null;

    autoWeighments.push({
      vehicle_number: plate,
      in_detected_vehicle_number: plate,
      out_detected_vehicle_number: isCompleted ? plate : null,
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

  // Factory 2 Auto Weighments
  for (let i = 0; i < 10; i++) {
    const plate = samplePlates[(i + 6) % samplePlates.length];
    const isCompleted = i % 4 !== 0;
    const inWeight = 22000 + ((i * 410) % 12000);
    const outWeight = isCompleted ? inWeight - 10000 - ((i * 150) % 3000) : null;
    const inCenterId = secondaryCenterIds[i % secondaryCenterIds.length];
    const outCenterId = isCompleted
      ? secondaryCenterIds[(i + 1) % secondaryCenterIds.length]
      : null;
    const inTime = daysAgo(Math.floor(i / 2), (i % 18) * 25);
    const outTime = isCompleted ? daysAgo(Math.floor(i / 2), (i % 18) * 25 - 40) : null;

    autoWeighments.push({
      vehicle_number: plate,
      in_detected_vehicle_number: plate,
      out_detected_vehicle_number: isCompleted ? plate : null,
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
    .select("id");

  if (autoErr || !createdAuto) throw autoErr;
  console.log(`  ✓ Seeded ${createdAuto.length} automatic weighments.`);

  // 4B. Manual Weighments (20 for Factory 1, 10 for Factory 2)
  const operatorId1 = userMap.get("operator1")!;
  const operatorId2 = userMap.get("operator2")!;
  const operatorApexId = userMap.get("operatorApex1")!;

  const manualWeighments = [];

  // Factory 1 Manual Weighments
  for (let i = 0; i < 20; i++) {
    const plate = samplePlates[(i + 3) % samplePlates.length];
    const isCompleted = i % 4 !== 0;
    const inWeight = 18000 + ((i * 450) % 12000);
    const outWeight = isCompleted ? inWeight + 9500 + ((i * 120) % 3000) : null;
    const inCenterId = primaryCenterIds[i % primaryCenterIds.length];
    const outCenterId = isCompleted ? primaryCenterIds[(i + 2) % primaryCenterIds.length] : null;
    const inTime = daysAgo(Math.floor(i / 2), (i % 12) * 35);
    const outTime = isCompleted ? daysAgo(Math.floor(i / 2), (i % 12) * 35 - 50) : null;

    manualWeighments.push({
      vehicle_number: plate,
      in_weight: inWeight,
      out_weight: outWeight,
      in_time: inTime,
      out_time: outTime,
      in_center_id: inCenterId,
      out_center_id: outCenterId,
      in_creator_id: operatorId1,
      out_creator_id: isCompleted ? operatorId2 : null,
      images: sampleImages.slice(0, 1),
      created_at: inTime,
      updated_at: outTime ?? inTime,
    });
  }

  // Factory 2 Manual Weighments
  for (let i = 0; i < 10; i++) {
    const plate = samplePlates[(i + 5) % samplePlates.length];
    const isCompleted = i % 3 !== 0;
    const inWeight = 19000 + ((i * 380) % 11000);
    const outWeight = isCompleted ? inWeight + 8500 + ((i * 140) % 2500) : null;
    const inCenterId = secondaryCenterIds[i % secondaryCenterIds.length];
    const outCenterId = isCompleted
      ? secondaryCenterIds[(i + 1) % secondaryCenterIds.length]
      : null;
    const inTime = daysAgo(Math.floor(i / 2), (i % 14) * 30);
    const outTime = isCompleted ? daysAgo(Math.floor(i / 2), (i % 14) * 30 - 45) : null;

    manualWeighments.push({
      vehicle_number: plate,
      in_weight: inWeight,
      out_weight: outWeight,
      in_time: inTime,
      out_time: outTime,
      in_center_id: inCenterId,
      out_center_id: outCenterId,
      in_creator_id: operatorApexId,
      out_creator_id: isCompleted ? operatorApexId : null,
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
  console.log(`  ✓ Seeded ${createdManual.length} manual weighments.`);

  // 5. TICKETS LINKED TO AUTOMATIC WEIGHMENTS (Full ticket_status coverage)
  console.log("\n🎫 [5/5] Seeding Support Tickets across all ticket_status variants...");
  const ticketConfigs = [
    // Factory 1 approved ticket
    {
      concern: "Camera detected plate obscured by mud on inbound scale.",
      reply: "Plate verified manually by operator on gate.",
      status: "approved",
      automatic_weighment_id: createdAuto[0].id,
      user_id: operatorId1,
    },
    // Factory 1 approved ticket 2
    {
      concern: "Gross weight fluctuation detected during windy conditions.",
      reply: "Re-weighed on auxiliary platform.",
      status: "approved",
      automatic_weighment_id: createdAuto[1].id,
      user_id: operatorId2,
    },
    // Factory 1 pending ticket
    {
      concern: "Unmatched outbound weighment query awaiting driver clarification.",
      reply: null,
      status: "pending",
      automatic_weighment_id: createdAuto[2].id,
      user_id: operatorId1,
    },
    // Factory 2 rejected ticket
    {
      concern: "Request to void completed weighment ticket due to incorrect tare.",
      reply: "Rejected. Delivery invoice has already been issued.",
      status: "rejected",
      automatic_weighment_id: createdAuto[30].id, // First Factory 2 auto weighment
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
