/**
 * @file scripts/test-seed.ts
 * @description Comprehensive database seed script for development, manual testing, and automated QA.
 * Seeds rich test datasets across factories, users (all 5 roles), centers (auto & manual),
 * commodities, rates, customers (linked & unlinked), entries (various statuses, types, dates),
 * and merged weighment pairs.
 */

import { createClient } from "@supabase/supabase-js";
import { EntryStatus, Role } from "../lib/constants/enums";
import { hashPassword } from "../lib/auth/password";
import {
  TABLES_IN_CLEAR_ORDER,
  DEFAULT_COMMODITIES,
  MOCK_IMAGES,
  FACTORY_CONFIGS,
  getUserConfigs,
  getHardwareUserConfigs,
  getCenterConfigs,
  getRateConfigs,
  getCustomerConfigs,
  getWeighmentPairScenarios,
  getStandaloneEntries,
  getSampleTickets,
  getRelativeDate,
} from "./fixtures/seed-data";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase URL and key environment variables are required.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearDatabase() {
  console.log("🧹 [Clean Mode] Clearing all existing records from database...");
  for (const table of TABLES_IN_CLEAR_ORDER) {
    const { error } = await supabase.from(table).delete().neq("id", 0);
    if (error) {
      if (error.code === "PGRST205") {
        console.warn(`⚠️ Table '${table}' does not exist in Supabase database schema.`);
      } else {
        console.warn(`⚠️ Could not clear table ${table}:`, error.message);
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
  console.log("🚀 Starting Comprehensive Test Seeding");
  console.log(`📡 Supabase Endpoint: ${supabaseUrl}`);
  console.log(`🧹 Clean Mode: ${shouldClean ? "ENABLED" : "DISABLED"}`);
  console.log("=================================================");

  if (shouldClean) {
    await clearDatabase();
  }

  // 1. FACTORIES
  console.log("\n🏭 [1/8] Seeding Factories...");
  const factoryMap = new Map<string, number>();

  for (const f of FACTORY_CONFIGS) {
    const { data: existing } = await supabase
      .from("factories")
      .select("id")
      .eq("name", f.name)
      .maybeSingle();

    if (existing) {
      factoryMap.set(f.name, existing.id);
      console.log(`  ✓ Found existing factory: '${f.name}' (id: ${existing.id})`);
    } else {
      const { data: created, error } = await supabase
        .from("factories")
        .insert({ name: f.name })
        .select("id")
        .single();
      if (error || !created) throw error || new Error(`Failed to insert factory ${f.name}`);
      factoryMap.set(f.name, created.id);
      console.log(`  + Created factory: '${f.name}' (id: ${created.id})`);
    }
  }

  const primaryFactoryId = factoryMap.get("Default Factory")!;
  const secondaryFactoryId = factoryMap.get("Apex Agro Logistics")!;

  // 2. USERS
  console.log(
    "\n👥 [2/8] Seeding Users across all personnel roles (Admin, Manager, Operator, Base)...",
  );
  console.log("  🔒 Hashing passwords with Argon2id...");
  const [adminPassHash, managerPassHash, operatorPassHash, basePassHash] = await Promise.all([
    hashPassword("admin123"),
    hashPassword("manager123"),
    hashPassword("operator123"),
    hashPassword("user123"),
  ]);

  const userConfigs = getUserConfigs(primaryFactoryId, secondaryFactoryId, {
    admin: adminPassHash,
    manager: managerPassHash,
    operator: operatorPassHash,
    base: basePassHash,
  });

  const userMap = new Map<string, number>();

  for (const u of userConfigs) {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", u.username)
      .maybeSingle();

    if (existing) {
      userMap.set(u.username, existing.id);
      console.log(`  ✓ Found user: '${u.username}' (${u.role}, id: ${existing.id})`);
    } else {
      const { data: created, error } = await supabase
        .from("users")
        .insert({
          username: u.username,
          name: u.name,
          role: u.role,
          password_hash: u.pass,
          factory_id: u.factoryId,
        })
        .select("id")
        .single();
      if (error || !created) throw error || new Error(`Failed to create user ${u.username}`);
      userMap.set(u.username, created.id);
      console.log(`  + Created user: '${u.username}' (${u.role}, id: ${created.id})`);
    }
  }

  // 3. CENTERS
  console.log("\n🏢 [3/8] Seeding Centers (Auto-Approve & Manual)...");
  const centerConfigs = getCenterConfigs(primaryFactoryId, secondaryFactoryId);
  const centerMap = new Map<string, number>();
  const centerFactoryMap = new Map<string, number>();

  for (const c of centerConfigs) {
    centerFactoryMap.set(c.name, c.factoryId);
    const { data: existing } = await supabase
      .from("centers")
      .select("id")
      .eq("name", c.name)
      .eq("factory_id", c.factoryId)
      .maybeSingle();

    if (existing) {
      centerMap.set(c.name, existing.id);
      console.log(
        `  ✓ Found center: '${c.name}' (auto_approve: ${c.auto_approve}, id: ${existing.id})`,
      );
    } else {
      const { data: created, error } = await supabase
        .from("centers")
        .insert({
          name: c.name,
          auto_approve: c.auto_approve,
          factory_id: c.factoryId,
        })
        .select("id")
        .single();
      if (error || !created) throw error || new Error(`Failed to create center ${c.name}`);
      centerMap.set(c.name, created.id);
      console.log(
        `  + Created center: '${c.name}' (auto_approve: ${c.auto_approve}, id: ${created.id})`,
      );
    }
  }

  // 3b. HARDWARE USERS (EDGE INGESTION DEVICES)
  console.log("\n📟 Seeding Edge Ingestion Hardware Users...");
  const hardwareConfigs = getHardwareUserConfigs();
  const hardwareUserMap = new Map<string, number>();

  for (const d of hardwareConfigs) {
    const centerFactoryId = centerFactoryMap.get(d.centerName) || primaryFactoryId;
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", d.username)
      .maybeSingle();

    if (existing) {
      hardwareUserMap.set(d.rawKey, existing.id);
      hardwareUserMap.set(d.centerName, existing.id);
      console.log(
        `  ✓ Found hardware user: id=${existing.id} (username: ${d.username}, center: ${d.centerName})`,
      );
    } else {
      const hashedPass = await hashPassword(d.rawKey);
      const { data: created, error } = await supabase
        .from("users")
        .insert({
          username: d.username,
          name: `${d.centerName} Scale`,
          password_hash: hashedPass,
          role: Role.HARDWARE,
          factory_id: centerFactoryId,
        })
        .select("id")
        .single();
      if (error || !created)
        throw error || new Error(`Failed to create hardware user for center ${d.centerName}`);
      hardwareUserMap.set(d.rawKey, created.id);
      hardwareUserMap.set(d.centerName, created.id);
      console.log(
        `  + Created hardware user: id=${created.id} (username: ${d.username}, center: ${d.centerName})`,
      );
    }
  }

  // 4. COMMODITIES
  console.log("\n🌾 [4/8] Seeding Commodities Catalog...");
  const commodityMap = new Map<string, number>();

  for (const item of DEFAULT_COMMODITIES) {
    const { data: existing } = await supabase
      .from("commodities")
      .select("id")
      .eq("name", item.name)
      .maybeSingle();

    if (existing) {
      commodityMap.set(item.name, existing.id);
    } else {
      const { data: created, error } = await supabase
        .from("commodities")
        .insert({ name: item.name })
        .select("id")
        .single();
      if (error || !created) throw error || new Error(`Failed to create commodity ${item.name}`);
      commodityMap.set(item.name, created.id);
    }
  }
  console.log(`  ✓ Seeded ${commodityMap.size} commodities catalog items.`);

  // 5. RATES
  console.log("\n💰 [5/8] Seeding Commodity Rates...");
  const rateConfigs = getRateConfigs(primaryFactoryId, secondaryFactoryId);
  const rateMap = new Map<string, number>();

  for (const r of rateConfigs) {
    const commId = commodityMap.get(r.commodity);
    if (!commId) continue;
    const rateKey = `${r.commodity}_${r.unit}_${r.factoryId}`;

    const { data: existing } = await supabase
      .from("rates")
      .select("id")
      .eq("commodity_id", commId)
      .eq("unit", r.unit)
      .eq("factory_id", r.factoryId)
      .maybeSingle();

    if (existing) {
      rateMap.set(rateKey, existing.id);
    } else {
      const { data: created, error } = await supabase
        .from("rates")
        .insert({
          commodity_id: commId,
          unit_price: r.unit_price,
          unit: r.unit,
          factory_id: r.factoryId,
        })
        .select("id")
        .single();
      if (error || !created) throw error || new Error(`Failed to create rate for ${r.commodity}`);
      rateMap.set(rateKey, created.id);
    }
  }
  console.log(`  ✓ Seeded ${rateMap.size} pricing rate entries.`);

  // 6. CUSTOMERS
  console.log("\n🧑‍🌾 [6/8] Seeding Customers (Linked to Base Users and Standalone)...");
  const customerConfigs = getCustomerConfigs(primaryFactoryId, secondaryFactoryId);
  const customerMap = new Map<string, number>();

  for (const cust of customerConfigs) {
    const userId = cust.username ? userMap.get(cust.username) : null;
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("name", cust.name)
      .eq("factory_id", cust.factoryId)
      .maybeSingle();

    if (existing) {
      customerMap.set(cust.name, existing.id);
    } else {
      const { data: created, error } = await supabase
        .from("customers")
        .insert({
          name: cust.name,
          father_name: cust.father_name,
          user_id: userId,
          factory_id: cust.factoryId,
        })
        .select("id")
        .single();
      if (error || !created) throw error || new Error(`Failed to create customer ${cust.name}`);
      customerMap.set(cust.name, created.id);
    }
  }
  console.log(`  ✓ Seeded ${customerMap.size} customer profiles.`);

  // 7. ENTRIES & WEIGHMENTS
  console.log("\n🚛 [7/8] Seeding Paired Entries and Weighments across date presets...");
  const defaultOperatorId = userMap.get("operator_bob") || userMap.get("admin1")!;
  const charlieOperatorId = userMap.get("operator_charlie") || defaultOperatorId;
  const defaultHardwareUserId = hardwareUserMap.get("hardware123") || 1;
  const apexHardwareUserId = hardwareUserMap.get("hardware789") || 2;

  const mainCenterId = centerMap.get("Main Weighbridge")!;
  const northAutoCenterId = centerMap.get("North Automatic Scale")!;
  const eastTerminalCenterId = centerMap.get("East Grain Terminal")!;
  const southExpressCenterId = centerMap.get("South Express Bay")!;

  const weighmentPairScenarios = getWeighmentPairScenarios({
    defaultOperatorId,
    charlieOperatorId,
    defaultHardwareUserId,
    mainCenterId,
    northAutoCenterId,
    eastTerminalCenterId,
    southExpressCenterId,
    wheatRateKg: rateMap.get(`Wheat_kg_${primaryFactoryId}`),
    copperRateKg: rateMap.get(`Scrap Copper_kg_${primaryFactoryId}`),
    cornRateKg: rateMap.get(`Corn_kg_${primaryFactoryId}`),
    wineRateGal: rateMap.get(`Wine_gal_${primaryFactoryId}`),
    sugarRateQ: rateMap.get(`Sugarcane_q_${primaryFactoryId}`),
    soyRateKg: rateMap.get(`Soybeans_kg_${primaryFactoryId}`),
  });

  let seededWeighmentsCount = 0;
  const sampleEntryIds: number[] = [];
  const sampleWeighmentIds: number[] = [];

  for (const pair of weighmentPairScenarios) {
    const custId = customerMap.get(pair.customerName);
    const inCreatedAt = getRelativeDate(pair.daysAgo, pair.inHoursAgo);
    const outCreatedAt = getRelativeDate(pair.daysAgo, pair.outHoursAgo);

    const isHardware = Boolean(pair.hardwareUserId);
    const createdBy =
      pair.createdBy ?? (isHardware ? defaultHardwareUserId : (pair.userId ?? defaultOperatorId));
    const approvedBy =
      pair.approvedBy ?? (pair.autoApproved ? createdBy : (pair.userId ?? defaultOperatorId));

    // Insert In Entry
    const { data: inEntry, error: inErr } = await supabase
      .from("entries")
      .insert({
        detected_vehicle_number: pair.detectedVehicle || pair.vehicleNumber,
        vehicle_number: pair.vehicleNumber,
        weight: pair.inWeight,
        status: EntryStatus.APPROVED,
        auto_approved: pair.autoApproved,
        center_id: pair.centerId,
        created_by: createdBy,
        approved_by: approvedBy,
        customer_id: custId || null,
        images: MOCK_IMAGES,
        created_at: inCreatedAt,
        updated_at: inCreatedAt,
      })
      .select("id")
      .single();

    if (inErr || !inEntry) {
      console.warn(`  ⚠️ Failed to create In Entry for ${pair.vehicleNumber}:`, inErr?.message);
      continue;
    }
    sampleEntryIds.push(inEntry.id);

    // Insert Out Entry
    const { data: outEntry, error: outErr } = await supabase
      .from("entries")
      .insert({
        detected_vehicle_number: pair.vehicleNumber,
        vehicle_number: pair.vehicleNumber,
        weight: pair.outWeight,
        status: EntryStatus.APPROVED,
        auto_approved: pair.autoApproved,
        center_id: pair.centerId,
        created_by: createdBy,
        approved_by: approvedBy,
        customer_id: custId || null,
        images: MOCK_IMAGES,
        created_at: outCreatedAt,
        updated_at: outCreatedAt,
      })
      .select("id")
      .single();

    if (outErr || !outEntry) {
      console.warn(`  ⚠️ Failed to create Out Entry for ${pair.vehicleNumber}:`, outErr?.message);
      continue;
    }

    // Insert Weighment linking In + Out
    const { data: createdW, error: wErr } = await supabase
      .from("weighments")
      .insert({
        in_entry_id: inEntry.id,
        out_entry_id: outEntry.id,
        unit: pair.unit,
        rate_id: pair.rateId || null,
        created_at: outCreatedAt,
        updated_at: outCreatedAt,
      })
      .select("id")
      .single();

    if (wErr) {
      console.warn(`  ⚠️ Failed to link weighment for ${pair.vehicleNumber}:`, wErr.message);
    } else {
      seededWeighmentsCount++;
      if (createdW) sampleWeighmentIds.push(createdW.id);
    }
  }

  console.log(`  ✓ Successfully created ${seededWeighmentsCount} merged double-entry weighments.`);

  // 8. UNPAIRED ENTRIES
  console.log(
    "\n📋 [8/8] Seeding Standalone Unpaired Entries (Pending, Rejected, Active On-Site)...",
  );

  const standaloneEntries = getStandaloneEntries({
    primaryFactoryId,
    secondaryFactoryId,
    userMap,
    centerMap,
    customerMap,
    defaultOperatorId,
    charlieOperatorId,
    defaultHardwareUserId,
    apexHardwareUserId,
    mainCenterId,
    northAutoCenterId,
    eastTerminalCenterId,
    southExpressCenterId,
  });

  let standaloneCount = 0;
  for (const ent of standaloneEntries) {
    const { error } = await supabase.from("entries").insert({
      ...ent,
      updated_at: ent.created_at,
    });
    if (!error) standaloneCount++;
  }
  console.log(`  ✓ Seeded ${standaloneCount} standalone and edge-case entries.`);

  // 9. SUPPORT TICKETS
  console.log("\n🎫 [9/9] Seeding Support Tickets (Pending, Approved, Rejected)...");
  const sampleTickets = getSampleTickets({
    sampleEntryIds,
    sampleWeighmentIds,
    userMap,
  });

  let seededTicketsCount = 0;
  for (const t of sampleTickets) {
    const { error } = await supabase.from("tickets").insert({
      ...t,
      updated_at: t.created_at,
    });
    if (!error) seededTicketsCount++;
    else console.warn("  ⚠️ Ticket seed warning:", error.message);
  }
  console.log(
    `  ✓ Seeded ${seededTicketsCount} support tickets across pending, approved, and rejected states.`,
  );

  console.log("\n=================================================");
  console.log("🎉 Test Database Seeding Completed Successfully!");
  console.log("=================================================");
  console.log("📋 Test User Credentials Summary:");
  console.log("  • Admin 1:    admin1 / admin123 (Factory 1)");
  console.log("  • Manager 1:  manager_alice / manager123 (Factory 1)");
  console.log("  • Operator 1: operator_bob / operator123 (Factory 1)");
  console.log("  • Operator 2: operator_charlie / operator123 (Factory 1)");
  console.log("  • Customer:   cust_ramesh / user123 (Factory 1)");
  console.log("  • Admin 2:    admin2 / admin123 (Factory 2)");
  console.log("📋 Test Edge Ingestion Hardware Users Summary:");
  for (const d of hardwareConfigs) {
    const id = hardwareUserMap.get(d.rawKey);
    console.log(
      `  • Hardware User ${id}: [Center: '${d.centerName}'] (Username: ${d.username}, Password: ${d.rawKey})`,
    );
  }
  console.log("=================================================");
}

main().catch((err) => {
  console.error("❌ Test seeding failed:", err);
  process.exit(1);
});
