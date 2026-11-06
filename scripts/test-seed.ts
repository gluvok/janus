/**
 * @file scripts/test-seed.ts
 * @description High-volume database seed script for development, pagination, and testing.
 * Seeds rich test datasets across factories, users (staff roles), centers with API keys,
 * automatic & manual weighments (pending & completed), and support tickets.
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
      if (error.code === "PGRST205") {
        console.warn(`  ⚠️ Table '${table}' does not exist in schema.`);
      } else {
        console.warn(`  ⚠️ Could not clear table '${table}':`, error.message);
      }
    } else {
      console.log(`  ✓ Cleared table: ${table}`);
    }

    try {
      await supabase.rpc("reset_table_sequence", { table_name: table });
    } catch {
      // Ignore if rpc does not exist
    }
  }

  try {
    await supabase.rpc("reset_all_sequences");
    console.log("  ✓ Reset all auto-increment sequences.");
  } catch {
    // Ignore if rpc is not present
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
      if (error || !created) throw error || new Error(`Failed to create factory ${cfg.name}`);
      factoryMap.set(cfg.name, created.id);
    }
  }

  const primaryFactoryId = factoryMap.get("Mesto Industrial Alpha")!;
  const secondaryFactoryId = factoryMap.get("Apex Agro Logistics")!;
  console.log(`  ✓ Factories ready (Alpha: ${primaryFactoryId}, Apex: ${secondaryFactoryId})`);

  // 2. USERS
  console.log("\n👥 [2/5] Seeding Staff Users...");
  const adminHash = await argon2.hash("admin123");
  const managerHash = await argon2.hash("manager123");
  const operatorHash = await argon2.hash("operator123");

  const userConfigs = [
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
  console.log(`  ✓ Users ready: ${userMap.size} users.`);

  // 3. CENTERS WITH API KEYS
  console.log("\n⚖️ [3/5] Seeding Centers with dedicated API keys...");
  const centerNames = [
    "North Weighbridge",
    "South Inbound Scale",
    "East Gate Outbound",
    "Terminal 1 Bulk Scale",
    "Terminal 2 Silo Platform",
    "Apex Central Scale",
    "Apex Dockside Weighbridge",
    "Apex West Gate",
  ];

  const centerMap = new Map<string, number>();
  for (let i = 0; i < centerNames.length; i++) {
    const name = centerNames[i];
    const factoryId = i < 5 ? primaryFactoryId : secondaryFactoryId;
    const { data: existing } = await supabase
      .from("centers")
      .select("id, name")
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      centerMap.set(name, existing.id);
    } else {
      const apiKey = crypto.randomBytes(16).toString("hex");
      const { data: created, error } = await supabase
        .from("centers")
        .insert({
          name,
          factory_id: factoryId,
          api_key: apiKey,
        })
        .select("id, name")
        .single();
      if (error || !created) throw error;
      centerMap.set(name, created.id);
    }
  }
  const centerIds = Array.from(centerMap.values());
  console.log(`  ✓ Centers ready: ${centerIds.length} centers.`);

  // 4. AUTOMATIC & MANUAL WEIGHMENTS
  console.log("\n🚛 [4/5] Seeding Automatic and Manual Weighments...");
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

  const autoWeighments = [];
  for (let i = 0; i < 40; i++) {
    const plate = samplePlates[i % samplePlates.length];
    const isCompleted = i % 5 !== 0; // 80% completed, 20% pending
    const inWeight = 25000 + ((i * 370) % 15000);
    const outWeight = isCompleted ? inWeight - 12000 - ((i * 190) % 4000) : null;
    const inCenterId = centerIds[i % centerIds.length];
    const outCenterId = isCompleted ? centerIds[(i + 1) % centerIds.length] : null;
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

  const { data: createdAuto, error: autoErr } = await supabase
    .from("automatic_weighments")
    .insert(autoWeighments)
    .select("id");

  if (autoErr) console.warn("  ⚠️ Warning inserting automatic weighments:", autoErr.message);
  else console.log(`  ✓ Seeded ${createdAuto?.length ?? 0} automatic weighments.`);

  const operatorId1 = userMap.get("operator1")!;
  const operatorId2 = userMap.get("operator2")!;

  const manualWeighments = [];
  for (let i = 0; i < 25; i++) {
    const plate = samplePlates[(i + 3) % samplePlates.length];
    const isCompleted = i % 4 !== 0;
    const inWeight = 18000 + ((i * 450) % 12000);
    const outWeight = isCompleted ? inWeight + 9500 + ((i * 120) % 3000) : null;
    const inCenterId = centerIds[(i + 2) % centerIds.length];
    const outCenterId = isCompleted ? centerIds[(i + 3) % centerIds.length] : null;
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

  const { data: createdManual, error: manualErr } = await supabase
    .from("manual_weighments")
    .insert(manualWeighments)
    .select("id");

  if (manualErr) console.warn("  ⚠️ Warning inserting manual weighments:", manualErr.message);
  else console.log(`  ✓ Seeded ${createdManual?.length ?? 0} manual weighments.`);

  // 5. TICKETS LINKED TO AUTOMATIC WEIGHMENTS
  console.log("\n🎫 [5/5] Seeding Support Tickets referencing automatic weighments...");
  if (createdAuto && createdAuto.length > 0) {
    const ticketConfigs = [
      {
        concern: "Camera detected plate obscured by mud on inbound scale.",
        reply: "Plate verified manually by operator on gate.",
        status: "approved",
        weighment_id: createdAuto[0].id,
        user_id: operatorId1,
      },
      {
        concern: "Gross weight fluctuation detected during windy conditions.",
        reply: "Re-weighed on auxiliary platform.",
        status: "approved",
        automatic_weighment_id: createdAuto[1].id,
        user_id: operatorId2,
      },
      {
        concern: "Unmatched outbound weighment query.",
        reply: null,
        status: "pending",
        automatic_weighment_id: createdAuto[2].id,
        user_id: operatorId1,
      },
    ];

    const { data: createdTickets, error: ticketErr } = await supabase
      .from("tickets")
      .insert(ticketConfigs)
      .select("id");

    if (ticketErr) console.warn("  ⚠️ Warning inserting tickets:", ticketErr.message);
    else console.log(`  ✓ Seeded ${createdTickets?.length ?? 0} tickets.`);
  }

  console.log("\n=================================================");
  console.log("🎉 Test database seeding complete!");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("❌ Test seeding failed:", err);
  process.exit(1);
});
