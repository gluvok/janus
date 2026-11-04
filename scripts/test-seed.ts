/**
 * @file scripts/test-seed.ts
 * @description High-volume database seed script for development, pagination, and testing using Drizzle ORM and Turso.
 * Seeds rich test datasets across factories, users (staff roles), centers,
 * customers, entries (paired & standalone), weighments, and support tickets
 * matching schema.sql with staggered timestamps for authentic pagination & sorting.
 */

import argon2 from "argon2";
import { inArray } from "drizzle-orm";
import { db, client, schema } from "../db/client.ts";

type Role = "admin" | "manager" | "operator" | "base";
type WeighmentType = "in" | "out";
type TicketStatus = "pending" | "resolved" | "rejected";

/**
 * Returns an ISO timestamp offset by `days` days and `minutesOffset` minutes into the past.
 */
function daysAgo(days: number, minutesOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setMinutes(d.getMinutes() - minutesOffset);
  return d.toISOString();
}

/**
 * Clear all existing records and reset sequences.
 */
async function clearDatabase() {
  console.log("🧹 [Clean Mode] Clearing all existing records from database...");

  await db.delete(schema.tickets);
  await db.delete(schema.automatic_weighments);
  await db.delete(schema.manual_weighments);
  await db.delete(schema.automatic_entries);
  await db.delete(schema.manual_entries);
  await db.delete(schema.devices);
  await db.delete(schema.sessions);
  await db.delete(schema.customers);
  await db.delete(schema.centers);
  await db.delete(schema.users);
  await db.delete(schema.factories);

  try {
    await client.execute("DELETE FROM sqlite_sequence;");
    console.log("  ✓ Reset all auto-increment sequences.");
  } catch {
    // Ignore if sqlite_sequence is empty or not yet created
  }
}

async function main() {
  const args = process.argv.slice(2);
  const shouldClean =
    args.includes("--clean") || args.includes("--reset") || process.env.RESET === "true";

  console.log("=================================================");
  console.log("🚀 Starting Mesto High-Volume Test Database Seeding (Turso / Drizzle)");
  console.log(`📡 Database URL: ${process.env.TURSO_DATABASE_URL || "default"}`);
  console.log(`🧹 Clean Mode: ${shouldClean ? "ENABLED" : "DISABLED"}`);
  console.log("=================================================");

  if (shouldClean) {
    await clearDatabase();
  }

  // 1. FACTORIES (2 Factories)
  console.log("\n🏭 [1/7] Seeding Factories...");
  const factoryConfigs = [{ name: "Default Factory" }, { name: "Apex Agro Logistics" }];
  const factoryMap = new Map<string, number>();

  const factoryNames = factoryConfigs.map((f) => f.name);
  const existingFactories = await db
    .select({ id: schema.factories.id, name: schema.factories.name })
    .from(schema.factories)
    .where(inArray(schema.factories.name, factoryNames));

  for (const f of existingFactories) {
    factoryMap.set(f.name, f.id);
    console.log(`  ✓ Found existing factory: '${f.name}' (id: ${f.id})`);
  }

  const missingFactories = factoryConfigs.filter((f) => !factoryMap.has(f.name));
  if (missingFactories.length > 0) {
    const createdFactories = await db
      .insert(schema.factories)
      .values(missingFactories)
      .returning({ id: schema.factories.id, name: schema.factories.name });

    for (const f of createdFactories) {
      factoryMap.set(f.name, f.id);
      console.log(`  + Created factory: '${f.name}' (id: ${f.id})`);
    }
  }

  const primaryFactoryId = factoryMap.get("Default Factory")!;
  const secondaryFactoryId = factoryMap.get("Apex Agro Logistics")!;

  // 2. USERS (Staff & Core profiles)
  console.log("\n👥 [2/7] Seeding Users (Staff profiles)...");
  console.log("  🔒 Pre-hashing role passwords once with Argon2id...");
  const [adminHash, managerHash, operatorHash] = await Promise.all([
    argon2.hash("admin123"),
    argon2.hash("manager123"),
    argon2.hash("operator123"),
  ]);

  interface UserSeedConfig {
    username: string;
    name: string;
    role: Role;
    passwordHash: string;
    factoryId: number;
  }

  const userConfigs: UserSeedConfig[] = [
    // Factory 1 Core & Staff
    {
      username: "admin1",
      name: "Admin Factory 1",
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
      username: "operator3",
      name: "Inbound Gate Operator",
      role: "operator",
      passwordHash: operatorHash,
      factoryId: primaryFactoryId,
    },
    {
      username: "operator4",
      name: "Silo Platform Operator",
      role: "operator",
      passwordHash: operatorHash,
      factoryId: primaryFactoryId,
    },
    {
      username: "operator5",
      name: "Night Shift Operator",
      role: "operator",
      passwordHash: operatorHash,
      factoryId: primaryFactoryId,
    },

    // Factory 2 Core & Staff
    {
      username: "admin2",
      name: "Admin Factory 2",
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
      username: "operator2",
      name: "Apex Terminal Operator 1",
      role: "operator",
      passwordHash: operatorHash,
      factoryId: secondaryFactoryId,
    },
    {
      username: "operator6",
      name: "Apex Terminal Operator 2",
      role: "operator",
      passwordHash: operatorHash,
      factoryId: secondaryFactoryId,
    },
  ];

  const userMap = new Map<string, number>();
  const usernames = userConfigs.map((u) => u.username);

  const existingUsers = await db
    .select({ id: schema.users.id, username: schema.users.username })
    .from(schema.users)
    .where(inArray(schema.users.username, usernames));

  for (const u of existingUsers) {
    if (u.username) userMap.set(u.username, u.id);
  }

  const missingUsers = userConfigs.filter((u) => !userMap.has(u.username));
  if (missingUsers.length > 0) {
    const createdUsers = await db
      .insert(schema.users)
      .values(
        missingUsers.map((u) => ({
          username: u.username,
          name: u.name,
          role: u.role,
          password_hash: u.passwordHash,
          factory_id: u.factoryId,
        })),
      )
      .returning({ id: schema.users.id, username: schema.users.username });

    for (const u of createdUsers) {
      if (u.username) userMap.set(u.username, u.id);
    }
  }
  console.log(`  ✓ Seeded ${userMap.size} users across staff roles.`);

  // 3. CENTERS (50 Centers: 35 for Factory 1, 15 for Factory 2)
  console.log("\n⚖️ [3/7] Seeding 50 Centers (35 Factory 1, 15 Factory 2)...");
  const factory1CenterNames = [
    "Main Weighbridge",
    "North Gate Scale",
    "South Silo Terminal",
    "Grain Unloading Bay 1",
    "Grain Unloading Bay 2",
    "East Platform Scale",
    "West Weighbridge",
    "Central Hopper Scale",
    "Raw Material Depot",
    "Dispatch Bridge A",
    "Dispatch Bridge B",
    "Auxiliary Terminal 1",
    "Auxiliary Terminal 2",
    "Bio-Fuel Intake Scale",
    "Fertilizer Unloading Dock",
    "Bulk Storage Terminal",
    "Export Inspection Bridge",
    "Warehouse 3 Scale",
    "Warehouse 7 Scale",
    "Rail Siding Scale 1",
    "Rail Siding Scale 2",
    "Container Yard Bridge",
    "Heavy Haul Scale East",
    "Heavy Haul Scale West",
    "Grain Elevator Scale",
    "Cold Storage Weighbridge",
    "Processing Plant Scale 1",
    "Processing Plant Scale 2",
    "Liquid Cargo Weighbridge",
    "Seed Processing Terminal",
    "By-Products Scale",
    "Maintenance Yard Scale",
    "Feed Mill Platform",
    "Paddy Intake Bridge",
    "Emergency Standby Bridge",
  ];

  const factory2CenterNames = [
    "Apex Central Weighbridge",
    "Apex North Scale",
    "Apex South Gate",
    "Apex Grain Dock 1",
    "Apex Grain Dock 2",
    "Apex Container Scale",
    "Apex Rail Scale",
    "Apex Heavy Platform",
    "Apex Silo Complex",
    "Apex Agro Depot 1",
    "Apex Agro Depot 2",
    "Apex Dispatch Terminal",
    "Apex Express Bridge",
    "Apex Bulk Transfer",
    "Apex West Gate Scale",
  ];

  interface CenterInsert {
    name: string;
    factory_id: number;
    created_at: string;
  }

  const centersToInsert: CenterInsert[] = [];

  factory1CenterNames.forEach((name, idx) => {
    centersToInsert.push({
      name,
      factory_id: primaryFactoryId,
      created_at: daysAgo(50 - idx, idx * 12),
    });
  });

  factory2CenterNames.forEach((name, idx) => {
    centersToInsert.push({
      name,
      factory_id: secondaryFactoryId,
      created_at: daysAgo(30 - idx, idx * 18),
    });
  });

  const centerMap = new Map<string, number>();

  const existingCenters = await db
    .select({
      id: schema.centers.id,
      name: schema.centers.name,
      factory_id: schema.centers.factory_id,
    })
    .from(schema.centers)
    .where(inArray(schema.centers.factory_id, [primaryFactoryId, secondaryFactoryId]));

  for (const c of existingCenters) {
    centerMap.set(c.name, c.id);
  }

  const missingCenters = centersToInsert.filter((c) => !centerMap.has(c.name));
  if (missingCenters.length > 0) {
    const createdCenters = await db
      .insert(schema.centers)
      .values(missingCenters)
      .returning({ id: schema.centers.id, name: schema.centers.name });

    for (const c of createdCenters) {
      centerMap.set(c.name, c.id);
    }
  }
  console.log(`  ✓ Seeded ${centerMap.size} centers (35 Default Factory, 15 Apex Agro Logistics).`);

  // Provision 1:1 matching devices for each center
  const deviceMap = new Map<number, number>();
  const deviceKeyHash = await argon2.hash("device_secret_key_123");
  const allCenterIds = Array.from(centerMap.values());
  const devicesToInsert = allCenterIds.map((centerId) => ({
    center_id: centerId,
    api_key_hash: deviceKeyHash,
  }));

  const existingDevices = await db
    .select({ id: schema.devices.id, center_id: schema.devices.center_id })
    .from(schema.devices);

  const existingCenterIds = new Set<number>();
  for (const d of existingDevices) {
    deviceMap.set(d.center_id, d.id);
    existingCenterIds.add(d.center_id);
  }

  const missingDevices = devicesToInsert.filter((d) => !existingCenterIds.has(d.center_id));
  if (missingDevices.length > 0) {
    const createdDevices = await db
      .insert(schema.devices)
      .values(missingDevices)
      .returning({ id: schema.devices.id, center_id: schema.devices.center_id });

    for (const d of createdDevices) {
      deviceMap.set(d.center_id, d.id);
    }
  }
  console.log(`  ✓ Provisioned ${deviceMap.size} 1:1 hardware devices in 'devices' table.`);

  // 4. CUSTOMERS (50 Customer Profiles)
  console.log("\n🧑‍🌾 [4/7] Seeding 50 Customers...");
  const customerRawConfigs: Array<{
    name: string;
    username: string | null;
    factoryId: number;
    daysOffset: number;
  }> = [
    // Factory 1 Customers (35)
    {
      name: "Kisan Agro Traders",
      username: "kisan_agro",
      factoryId: primaryFactoryId,
      daysOffset: 45,
    },
    {
      name: "Punjab Grain Logistics",
      username: "punjab_grain",
      factoryId: primaryFactoryId,
      daysOffset: 44,
    },
    {
      name: "Haryana Wheat Syndicate",
      username: "haryana_wheat",
      factoryId: primaryFactoryId,
      daysOffset: 43,
    },
    {
      name: "Golden Harvest Millers",
      username: "golden_harvest",
      factoryId: primaryFactoryId,
      daysOffset: 42,
    },
    {
      name: "Bharat Rice Exports",
      username: "bharat_rice",
      factoryId: primaryFactoryId,
      daysOffset: 41,
    },
    { name: "Maha Agri Corp", username: "maha_agri", factoryId: primaryFactoryId, daysOffset: 40 },
    {
      name: "Deccan Flour Mills",
      username: "deccan_flour",
      factoryId: primaryFactoryId,
      daysOffset: 39,
    },
    {
      name: "Shree Krishna Feed Mills",
      username: "krishna_feed",
      factoryId: primaryFactoryId,
      daysOffset: 38,
    },
    {
      name: "Annapurna Grain Merchants",
      username: "annapurna_grain",
      factoryId: primaryFactoryId,
      daysOffset: 37,
    },
    {
      name: "Godavari Agro Supply",
      username: "godavari_agro",
      factoryId: primaryFactoryId,
      daysOffset: 36,
    },
    {
      name: "Malwa Cereals Co.",
      username: "malwa_cereals",
      factoryId: primaryFactoryId,
      daysOffset: 35,
    },
    {
      name: "Surat Pulses Depot",
      username: "surat_pulses",
      factoryId: primaryFactoryId,
      daysOffset: 34,
    },
    {
      name: "Avadh Agro Industries",
      username: "avadh_agro",
      factoryId: primaryFactoryId,
      daysOffset: 33,
    },
    {
      name: "Indus Grain Storage",
      username: "indus_grain",
      factoryId: primaryFactoryId,
      daysOffset: 32,
    },
    {
      name: "Satluj Farm Produce",
      username: "satluj_produce",
      factoryId: primaryFactoryId,
      daysOffset: 31,
    },
    {
      name: "Kaveri Organics Ltd",
      username: "kaveri_org",
      factoryId: primaryFactoryId,
      daysOffset: 30,
    },
    {
      name: "Ganga Valley Millers",
      username: "ganga_millers",
      factoryId: primaryFactoryId,
      daysOffset: 29,
    },
    {
      name: "Vindhya Harvest Hub",
      username: "vindhya_hub",
      factoryId: primaryFactoryId,
      daysOffset: 28,
    },
    {
      name: "Marwar Grain Trading",
      username: "marwar_grain",
      factoryId: primaryFactoryId,
      daysOffset: 27,
    },
    {
      name: "Brahmaputra Agro Logistics",
      username: "brahma_agro",
      factoryId: primaryFactoryId,
      daysOffset: 26,
    },
    { name: "Konkan Seed Company", username: null, factoryId: primaryFactoryId, daysOffset: 25 },
    { name: "Carnatic Rice Mills", username: null, factoryId: primaryFactoryId, daysOffset: 24 },
    { name: "Doon Valley Agro", username: null, factoryId: primaryFactoryId, daysOffset: 23 },
    { name: "Thar Grain Consortium", username: null, factoryId: primaryFactoryId, daysOffset: 22 },
    { name: "Saurashtra Feeds", username: null, factoryId: primaryFactoryId, daysOffset: 21 },
    { name: "Utkal Cereals Corp", username: null, factoryId: primaryFactoryId, daysOffset: 20 },
    {
      name: "Bundelkhand Agro Traders",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 19,
    },
    { name: "Coromandel Produce", username: null, factoryId: primaryFactoryId, daysOffset: 18 },
    { name: "Rohilkhand Millers", username: null, factoryId: primaryFactoryId, daysOffset: 17 },
    { name: "Kalinga Agri Exports", username: null, factoryId: primaryFactoryId, daysOffset: 16 },
    { name: "Chola Grain Network", username: null, factoryId: primaryFactoryId, daysOffset: 15 },
    { name: "Mewar Farm Solutions", username: null, factoryId: primaryFactoryId, daysOffset: 14 },
    { name: "Khandesh Flour Co.", username: null, factoryId: primaryFactoryId, daysOffset: 13 },
    { name: "Bhoomi Grain Hub", username: null, factoryId: primaryFactoryId, daysOffset: 12 },
    { name: "Greenfield Agri Supply", username: null, factoryId: primaryFactoryId, daysOffset: 11 },

    // Factory 2 Customers (15)
    {
      name: "Apex Agro Feed Ltd",
      username: "apex_feed",
      factoryId: secondaryFactoryId,
      daysOffset: 16,
    },
    {
      name: "Apex Grain Dist",
      username: "apex_grain",
      factoryId: secondaryFactoryId,
      daysOffset: 15,
    },
    {
      name: "Apex Bio Energy",
      username: "apex_bio",
      factoryId: secondaryFactoryId,
      daysOffset: 14,
    },
    {
      name: "Apex Milling Corp",
      username: "apex_mill",
      factoryId: secondaryFactoryId,
      daysOffset: 13,
    },
    {
      name: "Apex Organics Hub",
      username: "apex_org",
      factoryId: secondaryFactoryId,
      daysOffset: 12,
    },
    {
      name: "Apex Pulse Terminal",
      username: "apex_pulse",
      factoryId: secondaryFactoryId,
      daysOffset: 11,
    },
    {
      name: "Apex Seed Producers",
      username: "apex_seeds",
      factoryId: secondaryFactoryId,
      daysOffset: 10,
    },
    {
      name: "Apex Dairy Feeds",
      username: "apex_dairy",
      factoryId: secondaryFactoryId,
      daysOffset: 9,
    },
    { name: "Apex Freight & Agro", username: null, factoryId: secondaryFactoryId, daysOffset: 8 },
    { name: "Apex Oilseed Trading", username: null, factoryId: secondaryFactoryId, daysOffset: 7 },
    { name: "Apex Wheat Depots", username: null, factoryId: secondaryFactoryId, daysOffset: 6 },
    { name: "Apex Corn Solutions", username: null, factoryId: secondaryFactoryId, daysOffset: 5 },
    { name: "Apex Export Grain", username: null, factoryId: secondaryFactoryId, daysOffset: 4 },
    { name: "Apex Terminal Storage", username: null, factoryId: secondaryFactoryId, daysOffset: 3 },
    { name: "Chambal Grain Storage", username: null, factoryId: secondaryFactoryId, daysOffset: 2 },
  ];

  const customerMap = new Map<string, number>();
  const customerNames = customerRawConfigs.map((c) => c.name);

  const existingCustomers = await db
    .select({ id: schema.customers.id, name: schema.customers.name })
    .from(schema.customers)
    .where(inArray(schema.customers.name, customerNames));

  for (const c of existingCustomers) {
    customerMap.set(c.name, c.id);
  }

  const missingCustomers = customerRawConfigs.filter((c) => !customerMap.has(c.name));
  if (missingCustomers.length > 0) {
    const createdCustomers = await db
      .insert(schema.customers)
      .values(
        missingCustomers.map((c) => ({
          name: c.name,
          factory_id: c.factoryId,
          created_at: daysAgo(c.daysOffset, 25),
        })),
      )
      .returning({ id: schema.customers.id, name: schema.customers.name });

    for (const c of createdCustomers) {
      customerMap.set(c.name, c.id);
    }
  }
  console.log(`  ✓ Seeded ${customerMap.size} customer profiles in customers table.`);

  // Helpers to get arrays of IDs for relationships
  const factory1CenterIds = factory1CenterNames.map((n) => centerMap.get(n)!);
  const factory2CenterIds = factory2CenterNames.map((n) => centerMap.get(n)!);
  const customerIdsArray = Array.from(customerMap.values());

  const operator1Id = userMap.get("operator1")!;
  const operator3Id = userMap.get("operator3")!;
  const manager1Id = userMap.get("manager1")!;
  const operator2Id = userMap.get("operator2")!;

  // 6. PAIRED ENTRIES & WEIGHMENTS (60 Pairs = 120 Entries & 60 Weighments)
  console.log(
    "\n🚛 [5/7] Seeding 60 Paired Inbound/Outbound Entries and Linked Weighments (40 pairs for Main Weighbridge)...",
  );
  const mainWeighbridgeId = centerMap.get("Main Weighbridge")!;
  const pairedVehicles: Array<{
    vehicle: string;
    factoryId: number;
    centerId: number;
    customerId: number;
    operatorId: number;
    grossWeight: number;
    tareWeight: number;
    daysOffset: number;
    minutesOffset: number;
  }> = [];

  // 40 Paired vehicles in Factory 1 concentrated on "Main Weighbridge"
  for (let i = 1; i <= 40; i++) {
    const vehicleNum = `MH12AB${1000 + i}`;
    const customerId = customerIdsArray[i % 35];
    const gross = 28000 + ((i * 950) % 22000);
    const tare = 9000 + ((i * 350) % 6500);
    pairedVehicles.push({
      vehicle: vehicleNum,
      factoryId: primaryFactoryId,
      centerId: mainWeighbridgeId,
      customerId,
      operatorId: i % 2 === 0 ? operator1Id : operator3Id,
      grossWeight: gross,
      tareWeight: tare,
      daysOffset: Math.floor(i / 2) + 1,
      minutesOffset: (i * 35) % 720,
    });
  }

  // 10 Paired vehicles across other Factory 1 centers
  for (let i = 1; i <= 10; i++) {
    const vehicleNum = `MH12AB${1040 + i}`;
    const otherCenters = factory1CenterIds.filter((id) => id !== mainWeighbridgeId);
    const centerId = otherCenters[i % otherCenters.length];
    const customerId = customerIdsArray[(i + 5) % 35];
    const gross = 29000 + ((i * 850) % 21000);
    const tare = 9500 + ((i * 320) % 6000);
    pairedVehicles.push({
      vehicle: vehicleNum,
      factoryId: primaryFactoryId,
      centerId,
      customerId,
      operatorId: i % 2 === 0 ? operator1Id : operator3Id,
      grossWeight: gross,
      tareWeight: tare,
      daysOffset: 15 + i,
      minutesOffset: (i * 45) % 720,
    });
  }

  // 10 Paired vehicles in Factory 2
  for (let i = 1; i <= 10; i++) {
    const vehicleNum = `MH14CD${2000 + i}`;
    const centerId = factory2CenterIds[i % factory2CenterIds.length];
    const customerId = customerIdsArray[35 + (i % 15)];
    const gross = 30000 + ((i * 800) % 20000);
    const tare = 10000 + ((i * 300) % 5500);
    pairedVehicles.push({
      vehicle: vehicleNum,
      factoryId: secondaryFactoryId,
      centerId,
      customerId,
      operatorId: operator2Id,
      grossWeight: gross,
      tareWeight: tare,
      daysOffset: 20 - i,
      minutesOffset: (i * 25) % 720,
    });
  }

  const autoPairedVehicles = pairedVehicles.slice(0, 30);
  const manualPairedVehicles = pairedVehicles.slice(30);
  const fallbackDeviceId = Array.from(deviceMap.values())[0] ?? 1;

  // --- AUTOMATIC PAIRED ENTRIES ---
  interface AutomaticEntryInsert {
    device_id: number;
    center_id: number;
    customer_id: number | null;
    detected_vehicle_number: string;
    vehicle_number: string;
    weight: number;
    images: string[];
    created_at: string;
  }

  const autoInEntriesToInsert: AutomaticEntryInsert[] = [];
  const autoOutEntriesToInsert: AutomaticEntryInsert[] = [];

  for (const pv of autoPairedVehicles) {
    const devId = deviceMap.get(pv.centerId) ?? fallbackDeviceId;
    autoInEntriesToInsert.push({
      device_id: devId,
      center_id: pv.centerId,
      customer_id: pv.customerId,
      detected_vehicle_number: pv.vehicle,
      vehicle_number: pv.vehicle,
      weight: pv.grossWeight,
      images: [],
      created_at: daysAgo(pv.daysOffset, pv.minutesOffset + 120),
    });

    autoOutEntriesToInsert.push({
      device_id: devId,
      center_id: pv.centerId,
      customer_id: pv.customerId,
      detected_vehicle_number: pv.vehicle,
      vehicle_number: pv.vehicle,
      weight: pv.tareWeight,
      images: [],
      created_at: daysAgo(pv.daysOffset, pv.minutesOffset),
    });
  }

  const createdAutoIn = await db
    .insert(schema.automatic_entries)
    .values(autoInEntriesToInsert)
    .returning({ id: schema.automatic_entries.id, center_id: schema.automatic_entries.center_id });

  const createdAutoOut = await db
    .insert(schema.automatic_entries)
    .values(autoOutEntriesToInsert)
    .returning({ id: schema.automatic_entries.id, center_id: schema.automatic_entries.center_id });

  // --- MANUAL PAIRED ENTRIES ---
  interface ManualEntryInsert {
    vehicle_number: string;
    weight: number;
    center_id: number;
    customer_id: number | null;
    creator_id: number;
    images: string[];
    created_at: string;
  }

  const manualInEntriesToInsert: ManualEntryInsert[] = [];
  const manualOutEntriesToInsert: ManualEntryInsert[] = [];

  for (const pv of manualPairedVehicles) {
    manualInEntriesToInsert.push({
      vehicle_number: pv.vehicle,
      weight: pv.grossWeight,
      center_id: pv.centerId,
      customer_id: pv.customerId,
      creator_id: pv.operatorId,
      images: [],
      created_at: daysAgo(pv.daysOffset, pv.minutesOffset + 120),
    });

    manualOutEntriesToInsert.push({
      vehicle_number: pv.vehicle,
      weight: pv.tareWeight,
      center_id: pv.centerId,
      customer_id: pv.customerId,
      creator_id: pv.operatorId,
      images: [],
      created_at: daysAgo(pv.daysOffset, pv.minutesOffset),
    });
  }

  const createdManualIn = await db
    .insert(schema.manual_entries)
    .values(manualInEntriesToInsert)
    .returning({ id: schema.manual_entries.id, center_id: schema.manual_entries.center_id });

  const createdManualOut = await db
    .insert(schema.manual_entries)
    .values(manualOutEntriesToInsert)
    .returning({ id: schema.manual_entries.id, center_id: schema.manual_entries.center_id });

  // Create linked automatic weighments
  interface WeighmentInsert {
    in_entry_id: number;
    out_entry_id: number;
    type: WeighmentType;
    created_at: string;
  }

  const autoWeighmentsToInsert: WeighmentInsert[] = [];
  for (let i = 0; i < createdAutoIn.length; i++) {
    const pv = autoPairedVehicles[i];
    autoWeighmentsToInsert.push({
      in_entry_id: createdAutoIn[i].id,
      out_entry_id: createdAutoOut[i].id,
      type: i % 4 === 0 ? "out" : "in",
      created_at: daysAgo(pv.daysOffset, pv.minutesOffset),
    });
  }

  const createdAutoWeighments = await db
    .insert(schema.automatic_weighments)
    .values(autoWeighmentsToInsert)
    .returning({ id: schema.automatic_weighments.id });

  // Create linked manual weighments
  const manualWeighmentsToInsert: WeighmentInsert[] = [];
  for (let i = 0; i < createdManualIn.length; i++) {
    const pv = manualPairedVehicles[i];
    manualWeighmentsToInsert.push({
      in_entry_id: createdManualIn[i].id,
      out_entry_id: createdManualOut[i].id,
      type: i % 4 === 0 ? "out" : "in",
      created_at: daysAgo(pv.daysOffset, pv.minutesOffset),
    });
  }

  const createdManualWeighments = await db
    .insert(schema.manual_weighments)
    .values(manualWeighmentsToInsert)
    .returning({ id: schema.manual_weighments.id });

  console.log(
    `  ✓ Created ${createdAutoWeighments.length} automatic weighments and ${createdManualWeighments.length} manual weighments.`,
  );

  // 7. STANDALONE UNPAIRED ENTRIES (50 Entries: 25 Automatic, 25 Manual)
  console.log("\n📋 [6/7] Seeding 50 Standalone Entries (25 Automatic, 25 Manual)...");

  const autoStandaloneToInsert: AutomaticEntryInsert[] = [];
  const manualStandaloneToInsert: ManualEntryInsert[] = [];

  // 25 Automatic Standalone Entries
  const otherFactory1CenterIds = factory1CenterIds.filter((id) => id !== mainWeighbridgeId);
  for (let i = 1; i <= 15; i++) {
    const plate = `DL01XY${3000 + i}`;
    const customerId = i % 4 === 0 ? null : customerIdsArray[i % 35];
    const devId = deviceMap.get(mainWeighbridgeId) ?? fallbackDeviceId;

    autoStandaloneToInsert.push({
      device_id: devId,
      center_id: mainWeighbridgeId,
      customer_id: customerId,
      detected_vehicle_number: plate,
      vehicle_number: plate,
      weight: 16000 + ((i * 1250) % 28000),
      images: [],
      created_at: daysAgo(Math.floor(i / 2) + 1, (i * 47) % 720),
    });
  }

  for (let i = 1; i <= 10; i++) {
    const plate = `KA04CD${4000 + i}`;
    const centerId = otherFactory1CenterIds[i % otherFactory1CenterIds.length];
    const customerId = i % 3 === 0 ? null : customerIdsArray[(i * 2) % 35];
    const devId = deviceMap.get(centerId) ?? fallbackDeviceId;

    autoStandaloneToInsert.push({
      device_id: devId,
      center_id: centerId,
      customer_id: customerId,
      detected_vehicle_number: plate,
      vehicle_number: plate,
      weight: 18000 + ((i * 1150) % 22000),
      images: [],
      created_at: daysAgo(5 + i, (i * 35) % 60),
    });
  }

  const createdAutoStandalone = await db
    .insert(schema.automatic_entries)
    .values(autoStandaloneToInsert)
    .returning({ id: schema.automatic_entries.id, center_id: schema.automatic_entries.center_id });

  // 25 Manual Standalone Entries
  for (let i = 16; i <= 25; i++) {
    const plate = `DL01XY${3000 + i}`;
    const customerId = i % 4 === 0 ? null : customerIdsArray[i % 35];
    const operatorId = i % 2 === 0 ? operator1Id : operator3Id;

    manualStandaloneToInsert.push({
      vehicle_number: plate,
      weight: 16000 + ((i * 1250) % 28000),
      center_id: mainWeighbridgeId,
      customer_id: customerId,
      creator_id: operatorId,
      images: [],
      created_at: daysAgo(Math.floor(i / 2) + 1, (i * 47) % 720),
    });
  }

  for (let i = 11; i <= 15; i++) {
    const plate = `KA04CD${4000 + i}`;
    const centerId = otherFactory1CenterIds[i % otherFactory1CenterIds.length];
    const customerId = i % 3 === 0 ? null : customerIdsArray[(i * 2) % 35];

    manualStandaloneToInsert.push({
      vehicle_number: plate,
      weight: 18000 + ((i * 1150) % 22000),
      center_id: centerId,
      customer_id: customerId,
      creator_id: operator1Id,
      images: [],
      created_at: daysAgo(5 + i, (i * 35) % 60),
    });
  }

  for (let i = 1; i <= 10; i++) {
    const plate = `GJ03EF${5000 + i}`;
    const centerId = factory2CenterIds[i % factory2CenterIds.length];

    manualStandaloneToInsert.push({
      vehicle_number: plate,
      weight: 14000 + ((i * 2100) % 36000),
      center_id: centerId,
      customer_id: null,
      creator_id: operator2Id,
      images: [],
      created_at: daysAgo(8 + i, (i * 50) % 60),
    });
  }

  const createdManualStandalone = await db
    .insert(schema.manual_entries)
    .values(manualStandaloneToInsert)
    .returning({ id: schema.manual_entries.id, center_id: schema.manual_entries.center_id });

  console.log(
    `  ✓ Created ${createdAutoStandalone.length} automatic standalone entries and ${createdManualStandalone.length} manual standalone entries.`,
  );

  // 7. TICKETS (20 Support Tickets linked to automatic entries)
  console.log("\n🎫 [7/7] Seeding 20 Support Tickets...");
  interface TicketInsert {
    concern: string;
    reply: string | null;
    status: TicketStatus;
    entry_id: number;
    user_id: number;
    created_at: string;
  }

  const ticketConcerns = [
    {
      concern: "Vehicle plate mismatch with transport manifest.",
      reply: "Verified physical gate register; operator corrected plate.",
      status: "resolved" as TicketStatus,
    },
    {
      concern: "Tare weight discrepancy exceeds allowed ±20kg tolerance margin.",
      reply: "Recalibrated weighbridge and re-verified tare weight.",
      status: "resolved" as TicketStatus,
    },
    {
      concern: "Driver disputed net weight recorded on outbound receipt.",
      reply: null,
      status: "pending" as TicketStatus,
    },
    {
      concern: "Camera 1 crop obscured by mud spatter on lens.",
      reply: "Cleaned optical sensor housing; test frame verified.",
      status: "resolved" as TicketStatus,
    },
    {
      concern: "Moisture rebate query from farmer on grain shipment.",
      reply: null,
      status: "pending" as TicketStatus,
    },
    {
      concern: "Gross weight exceeds legal highway payload rating (50MT).",
      reply: "Excess cargo offloaded at auxiliary depot prior to transit.",
      status: "resolved" as TicketStatus,
    },
    {
      concern: "Scale indicator oscillated due to high crosswinds.",
      reply: "Wind deflectors inspected and tightened.",
      status: "resolved" as TicketStatus,
    },
    {
      concern: "OCR failed to read obscured rear number plate.",
      reply: null,
      status: "pending" as TicketStatus,
    },
    {
      concern: "Entry submitted with incorrect destination center.",
      reply: "Re-routed shipment to Silo Unit 2.",
      status: "resolved" as TicketStatus,
    },
    {
      concern: "Duplicate inbound ticket generated during network timeout.",
      reply: "Duplicate entry voided by shift supervisor.",
      status: "rejected" as TicketStatus,
    },
    {
      concern: "Driver attempted re-entry without clearing outbound tare.",
      reply: "Vehicle turned back to outbound scale for proper cycle.",
      status: "rejected" as TicketStatus,
    },
    {
      concern: "Hardware scale disconnected from network during weighment.",
      reply: null,
      status: "pending" as TicketStatus,
    },
    {
      concern: "Uncalibrated zero-point offset detected during morning zero check.",
      reply: "Zero-point balanced by weighing technician.",
      status: "resolved" as TicketStatus,
    },
    {
      concern: "Customer account mapping missing on delivery challan.",
      reply: null,
      status: "pending" as TicketStatus,
    },
    {
      concern: "Axle sensor trigger skipped second trailer axle.",
      reply: "Multi-axle bridge sequencing sensor adjusted.",
      status: "resolved" as TicketStatus,
    },
    {
      concern: "Driver requested duplicate printed receipt copy.",
      reply: "Reprint issued with duplicate watermark.",
      status: "resolved" as TicketStatus,
    },
    {
      concern: "Unregistered transport carrier entered facility.",
      reply: "Vehicle redirected to visitor registration kiosk.",
      status: "rejected" as TicketStatus,
    },
    {
      concern: "Tare weight lighter than expected for truck empty chassis.",
      reply: null,
      status: "pending" as TicketStatus,
    },
    {
      concern: "Customer disputed weight deduction grade.",
      reply: "Quality control lab sample re-tested; confirmed grade B.",
      status: "rejected" as TicketStatus,
    },
    {
      concern: "Weighbridge surface debris accumulation warning.",
      reply: "Platform power-washed and inspected for zero stability.",
      status: "resolved" as TicketStatus,
    },
  ];

  const ticketsToInsert: TicketInsert[] = [];
  const availableAutoEntries = [...createdAutoStandalone, ...createdAutoIn];

  for (let i = 0; i < 20; i++) {
    const entry = availableAutoEntries[i % availableAutoEntries.length];
    const template = ticketConcerns[i % ticketConcerns.length];
    ticketsToInsert.push({
      concern: template.concern,
      reply: template.reply,
      status: template.status,
      entry_id: entry.id,
      user_id: i % 2 === 0 ? operator1Id : manager1Id,
      created_at: daysAgo(10 - Math.floor(i / 2), (i * 20) % 60),
    });
  }

  const createdTickets = await db
    .insert(schema.tickets)
    .values(ticketsToInsert)
    .returning({ id: schema.tickets.id });

  console.log(`  ✓ Seeded ${createdTickets.length} support tickets.`);

  console.log("\n=================================================");
  console.log("🎉 Database Seeding Completed Successfully!");
  console.log("=================================================");
  console.log("📊 Summary of Seeded Data Volumes:");
  console.log(`  • Factories:            ${factoryMap.size}`);
  console.log(`  • Users:                ${userMap.size} (Admin, Manager, Operator)`);
  console.log(
    `  • Centers:              ${centerMap.size} (Ideal for multi-page pagination testing)`,
  );
  console.log(
    `  • Devices:              ${deviceMap.size} (1:1 with Centers, API key authenticated)`,
  );
  console.log(`  • Customers:            ${customerMap.size}`);
  console.log(
    `  • Automatic Entries:    ${createdAutoIn.length + createdAutoOut.length + createdAutoStandalone.length} (${createdAutoIn.length + createdAutoOut.length} paired, ${createdAutoStandalone.length} standalone)`,
  );
  console.log(
    `  • Manual Entries:       ${createdManualIn.length + createdManualOut.length + createdManualStandalone.length} (${createdManualIn.length + createdManualOut.length} paired, ${createdManualStandalone.length} standalone)`,
  );
  console.log(`  • Automatic Weighments: ${createdAutoWeighments.length} (Linked paired cycles)`);
  console.log(`  • Manual Weighments:    ${createdManualWeighments.length} (Linked paired cycles)`);
  console.log(`  • Support Tickets:      ${createdTickets.length} (Linked to automatic entries)`);
  console.log("=================================================");
  console.log("📋 Test User Credentials Summary:");
  console.log("  [Factory 1: Default Factory]");
  console.log("  • Admin:     admin1 / admin123");
  console.log("  • Manager:   manager1 / manager123");
  console.log("  • Operator:  operator1, operator3, operator4, operator5 / operator123");
  console.log("  [Factory 2: Apex Agro Logistics]");
  console.log("  • Admin:     admin2 / admin123");
  console.log("  • Manager:   manager2 / manager123");
  console.log("  • Operator:  operator2, operator6 / operator123");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
