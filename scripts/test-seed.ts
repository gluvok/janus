/**
 * @file scripts/test-seed.ts
 * @description High-volume database seed script for development, pagination, and testing.
 * Seeds rich test datasets across factories, users (staff roles), centers,
 * customers, entries (paired & standalone), weighments, and support tickets
 * matching schema.sql with staggered timestamps for authentic pagination & sorting.
 */

import argon2 from "argon2";
import { supabase } from "./supabase.ts";

type Role = "admin" | "manager" | "operator" | "base";
type Unit = "kg" | "q" | "gal";
type WeighmentType = "unassigned" | "in" | "out";
type TicketStatus = "pending" | "approved" | "rejected";

const TABLES_IN_CLEAR_ORDER = [
  "automatic_tickets",
  "manual_tickets",
  "automatic_weighments",
  "manual_weighments",
  "automatic_entries",
  "manual_entries",
  "devices",
  "sessions",
  "customers",
  "centers",
  "users",
  "factories",
];

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
  const { data: existingFactories, error: factoryFetchErr } = await supabase
    .from("factories")
    .select("id, name")
    .in("name", factoryNames);

  if (factoryFetchErr) throw factoryFetchErr;
  for (const f of existingFactories || []) {
    factoryMap.set(f.name, f.id);
    console.log(`  ✓ Found existing factory: '${f.name}' (id: ${f.id})`);
  }

  const missingFactories = factoryConfigs.filter((f) => !factoryMap.has(f.name));
  if (missingFactories.length > 0) {
    const { data: createdFactories, error: factoryCreateErr } = await supabase
      .from("factories")
      .insert(missingFactories)
      .select("id, name");

    if (factoryCreateErr || !createdFactories) throw factoryCreateErr;
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

  const { data: existingUsers, error: usersFetchErr } = await supabase
    .from("users")
    .select("id, username")
    .in("username", usernames);

  if (usersFetchErr) throw usersFetchErr;
  for (const u of existingUsers || []) {
    if (u.username) userMap.set(u.username, u.id);
  }

  const missingUsers = userConfigs.filter((u) => !userMap.has(u.username));
  if (missingUsers.length > 0) {
    const { data: createdUsers, error: usersCreateErr } = await supabase
      .from("users")
      .insert(
        missingUsers.map((u) => ({
          username: u.username,
          name: u.name,
          role: u.role,
          password_hash: u.passwordHash,
          factory_id: u.factoryId,
        })),
      )
      .select("id, username");

    if (usersCreateErr || !createdUsers) throw usersCreateErr;
    for (const u of createdUsers) {
      if (u.username) userMap.set(u.username, u.id);
    }
  }
  console.log(`  ✓ Seeded ${userMap.size} users across staff roles.`);

  // 3. CENTERS (50 Centers: 35 for Factory 1, 15 for Factory 2)
  console.log("\n🏢 [3/7] Seeding 50 Centers (enabling rich multi-page pagination)...");
  const factory1CenterNames = [
    "Main Weighbridge",
    "North Automatic Scale",
    "South Gate Weighbridge",
    "East Inbound Scale",
    "West Outbound Scale",
    "Grain Silo Platform 1",
    "Grain Silo Platform 2",
    "Fertilizer Bulk Terminal",
    "Rail Inflow Weighbridge",
    "Central Logistics Platform",
    "North-East Weighbridge A",
    "North-East Weighbridge B",
    "South-West Rapid Scale",
    "Automated Bypass Scale 1",
    "Automated Bypass Scale 2",
    "Processing Unit 1 Scale",
    "Processing Unit 2 Scale",
    "Bulk Hopper Weighbridge",
    "Container Yard Scale A",
    "Container Yard Scale B",
    "Liquid Terminal Scale",
    "Feed Mill Weighbridge",
    "Storage Silo Scale 3",
    "Storage Silo Scale 4",
    "Express Exit Platform",
    "Raw Material Inflow Scale",
    "Finished Goods Scale",
    "Secondary Gate Weighbridge",
    "Dispatch Weighbridge 1",
    "Dispatch Weighbridge 2",
    "Heavy Freight Weighbridge",
    "Quality Check Scale",
    "Tare Verification Scale",
    "Reserve Auxiliary Scale",
    "Emergency Overflow Scale",
  ];

  const factory2CenterNames = [
    "Apex Terminal 1",
    "Apex South Scale",
    "Apex East Gate Platform",
    "Apex Railhead Scale",
    "Apex Bulk Grain Terminal",
    "Apex Automated Scale A",
    "Apex Automated Scale B",
    "Apex Silo Weighbridge",
    "Apex Express Scale",
    "Apex Inbound Platform 2",
    "Apex Outbound Platform 2",
    "Apex Dispatch Scale",
    "Apex Freight Yard Bridge",
    "Apex Auxiliary Scale",
    "Apex Inspection Scale",
  ];

  interface CenterInsertData {
    name: string;
    factory_id: number;
    created_at: string;
  }

  const centersToInsert: CenterInsertData[] = [];

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

  const { data: existingCenters, error: centersFetchErr } = await supabase
    .from("centers")
    .select("id, name, factory_id")
    .in("factory_id", [primaryFactoryId, secondaryFactoryId]);

  if (centersFetchErr) throw centersFetchErr;
  for (const c of existingCenters || []) {
    centerMap.set(c.name, c.id);
  }

  const missingCenters = centersToInsert.filter((c) => !centerMap.has(c.name));
  if (missingCenters.length > 0) {
    const { data: createdCenters, error: centersCreateErr } = await supabase
      .from("centers")
      .insert(missingCenters)
      .select("id, name");

    if (centersCreateErr || !createdCenters) throw centersCreateErr;
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

  // 1) Fetch existing devices that are not deleted
  const { data: existingDevices, error: fetchDevErr } = await supabase
    .from("devices")
    .select("id, center_id")
    .is("deleted_at", null);

  if (fetchDevErr) {
    if (fetchDevErr.code === "PGRST205") {
      console.warn("  ⚠️ Note: 'devices' table does not exist in schema cache yet.");
    } else {
      console.warn("  ⚠️ Could not fetch devices:", fetchDevErr.message);
    }
  } else {
    const existingCenterIds = new Set<number>();
    if (existingDevices) {
      for (const d of existingDevices) {
        deviceMap.set(d.center_id, d.id);
        existingCenterIds.add(d.center_id);
      }
    }

    const missingDevices = devicesToInsert.filter((d) => !existingCenterIds.has(d.center_id));
    if (missingDevices.length > 0) {
      const { data: createdDevices, error: devicesErr } = await supabase
        .from("devices")
        .insert(missingDevices)
        .select("id, center_id");

      if (devicesErr) {
        console.warn("  ⚠️ Could not seed devices:", devicesErr.message);
      } else if (createdDevices) {
        for (const d of createdDevices) {
          deviceMap.set(d.center_id, d.id);
        }
      }
    }
    console.log(`  ✓ Provisioned ${deviceMap.size} 1:1 hardware devices in 'devices' table.`);
  }

  // 4. CUSTOMERS (50 Customer Profiles)
  console.log("\n🧑‍🌾 [4/7] Seeding 50 Customers...");
  const customerRawConfigs: Array<{
    name: string;
    username: string | null;
    factoryId: number;
    daysOffset: number;
  }> = [
    // Factory 1 Customers
    {
      name: "Ramesh Kumar",
      username: "customer1",
      factoryId: primaryFactoryId,
      daysOffset: 45,
    },
    {
      name: "Anita Sharma",
      username: "customer2",
      factoryId: primaryFactoryId,
      daysOffset: 44,
    },
    {
      name: "Suresh Patel",
      username: "customer3",
      factoryId: primaryFactoryId,
      daysOffset: 43,
    },
    {
      name: "Rajendra Singh",
      username: "customer4",
      factoryId: primaryFactoryId,
      daysOffset: 42,
    },
    {
      name: "Vikram Rathore",
      username: "customer5",
      factoryId: primaryFactoryId,
      daysOffset: 41,
    },
    {
      name: "Pooja Verma",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 40,
    },
    {
      name: "Devendra Yadav",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 39,
    },
    {
      name: "Kavita Choudhary",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 38,
    },
    {
      name: "Sunil Deshmukh",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 37,
    },
    {
      name: "Prakash Joshi",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 36,
    },
    {
      name: "Mahesh Kulkarni",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 35,
    },
    {
      name: "Geeta Meena",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 34,
    },
    {
      name: "Harish Rawat",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 33,
    },
    {
      name: "Manoj Tiwari",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 32,
    },
    {
      name: "Anil Chauhan",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 31,
    },
    {
      name: "Babulal Gurjar",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 30,
    },
    {
      name: "Santosh Dhakad",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 29,
    },
    {
      name: "Mukesh Bhati",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 28,
    },
    {
      name: "Dharmendra Saini",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 27,
    },
    {
      name: "Rajeshwari Bai",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 26,
    },
    {
      name: "Jagdish Bishnoi",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 25,
    },
    {
      name: "Kailash Mali",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 24,
    },
    {
      name: "Govind Dan",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 23,
    },
    {
      name: "Bhawani Singh",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 22,
    },
    {
      name: "Manish Solanki",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 21,
    },
    {
      name: "Gopal Agarwal",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 20,
    },
    {
      name: "Nandkishore Vyas",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 19,
    },
    {
      name: "Kamla Devi",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 18,
    },
    {
      name: "Mohanlal Kumhar",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 17,
    },
    {
      name: "Ramswaroop Jat",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 16,
    },
    {
      name: "Bhagwan Sahay",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 15,
    },
    {
      name: "Shyam Sundar",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 14,
    },
    {
      name: "Ratan Lal",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 13,
    },
    {
      name: "Narendra Modi Logistics",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 12,
    },
    {
      name: "Suraj Agro Traders",
      username: null,
      factoryId: primaryFactoryId,
      daysOffset: 11,
    },

    // Factory 2 Customers
    {
      name: "Apex Agritech Co.",
      username: "customer6",
      factoryId: secondaryFactoryId,
      daysOffset: 30,
    },
    {
      name: "Kalyan Krishi Kendra",
      username: "customer7",
      factoryId: secondaryFactoryId,
      daysOffset: 28,
    },
    {
      name: "Vidarbha Agro Farms",
      username: "customer8",
      factoryId: secondaryFactoryId,
      daysOffset: 26,
    },
    {
      name: "Marathwada Bio Fuels",
      username: "customer9",
      factoryId: secondaryFactoryId,
      daysOffset: 24,
    },
    {
      name: "Deccan Grain Carriers",
      username: "customer10",
      factoryId: secondaryFactoryId,
      daysOffset: 22,
    },
    {
      name: "Sahyadri Agro Allied",
      username: null,
      factoryId: secondaryFactoryId,
      daysOffset: 20,
    },
    {
      name: "Baramati FPO",
      username: null,
      factoryId: secondaryFactoryId,
      daysOffset: 18,
    },
    {
      name: "Godavari Agro Exporters",
      username: null,
      factoryId: secondaryFactoryId,
      daysOffset: 16,
    },
    {
      name: "Krishna Valley Mills",
      username: null,
      factoryId: secondaryFactoryId,
      daysOffset: 14,
    },
    {
      name: "Western Agro Terminal",
      username: null,
      factoryId: secondaryFactoryId,
      daysOffset: 12,
    },
    {
      name: "Satpura Crop Sciences",
      username: null,
      factoryId: secondaryFactoryId,
      daysOffset: 10,
    },
    {
      name: "Panchganga Seed Co.",
      username: null,
      factoryId: secondaryFactoryId,
      daysOffset: 8,
    },
    {
      name: "Narmada Agri Products",
      username: null,
      factoryId: secondaryFactoryId,
      daysOffset: 6,
    },
    {
      name: "Malwa Agro Consortium",
      username: null,
      factoryId: secondaryFactoryId,
      daysOffset: 4,
    },
    {
      name: "Chambal Grain Storage",
      username: null,
      factoryId: secondaryFactoryId,
      daysOffset: 2,
    },
  ];

  const customerMap = new Map<string, number>();
  const customerNames = customerRawConfigs.map((c) => c.name);

  const { data: existingCustomers, error: custFetchErr } = await supabase
    .from("customers")
    .select("id, name")
    .in("name", customerNames);

  if (custFetchErr) throw custFetchErr;
  for (const c of existingCustomers || []) {
    customerMap.set(c.name, c.id);
  }

  const missingCustomers = customerRawConfigs.filter((c) => !customerMap.has(c.name));
  if (missingCustomers.length > 0) {
    const { data: createdCustomers, error: custCreateErr } = await supabase
      .from("customers")
      .insert(
        missingCustomers.map((c) => ({
          name: c.name,
          factory_id: c.factoryId,
          created_at: daysAgo(c.daysOffset, 25),
        })),
      )
      .select("id, name");

    if (custCreateErr || !createdCustomers) throw custCreateErr;
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
  // 40 pairs (80 entries) concentrated specifically on 'Main Weighbridge' for pagination testing
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
    const customerId = customerIdsArray[i % 35]; // Factory 1 customer
    const gross = 28000 + ((i * 950) % 22000); // 28,000 - 50,000 kg
    const tare = 9000 + ((i * 350) % 6500); // 9,000 - 15,500 kg
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
    const customerId = customerIdsArray[35 + (i % 15)]; // Factory 2 customer
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

  // Split pairedVehicles: 30 for automatic (hardware-captured), 30 for manual (operator-created)
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

  const { data: createdAutoIn, error: autoInErr } = await supabase
    .from("automatic_entries")
    .insert(autoInEntriesToInsert)
    .select("id, center_id, device_id");

  if (autoInErr || !createdAutoIn) {
    throw autoInErr || new Error("Failed to bulk insert automatic inbound entries");
  }

  const { data: createdAutoOut, error: autoOutErr } = await supabase
    .from("automatic_entries")
    .insert(autoOutEntriesToInsert)
    .select("id, center_id, device_id");

  if (autoOutErr || !createdAutoOut) {
    throw autoOutErr || new Error("Failed to bulk insert automatic outbound entries");
  }

  // --- MANUAL PAIRED ENTRIES ---
  interface ManualEntryInsert {
    vehicle_number: string;
    weight: number;
    center_id: number;
    customer_id: number | null;
    created_by: number;
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
      created_by: pv.operatorId,
      images: [],
      created_at: daysAgo(pv.daysOffset, pv.minutesOffset + 120),
    });

    manualOutEntriesToInsert.push({
      vehicle_number: pv.vehicle,
      weight: pv.tareWeight,
      center_id: pv.centerId,
      customer_id: pv.customerId,
      created_by: pv.operatorId,
      images: [],
      created_at: daysAgo(pv.daysOffset, pv.minutesOffset),
    });
  }

  const { data: createdManualIn, error: manualInErr } = await supabase
    .from("manual_entries")
    .insert(manualInEntriesToInsert)
    .select("id, center_id");

  if (manualInErr || !createdManualIn) {
    throw manualInErr || new Error("Failed to bulk insert manual inbound entries");
  }

  const { data: createdManualOut, error: manualOutErr } = await supabase
    .from("manual_entries")
    .insert(manualOutEntriesToInsert)
    .select("id, center_id");

  if (manualOutErr || !createdManualOut) {
    throw manualOutErr || new Error("Failed to bulk insert manual outbound entries");
  }

  // Create linked automatic weighments
  interface WeighmentInsert {
    in_entry_id: number;
    out_entry_id: number;
    unit: Unit;
    type: WeighmentType;
    created_at: string;
  }

  const autoWeighmentsToInsert: WeighmentInsert[] = [];
  for (let i = 0; i < createdAutoIn.length; i++) {
    const pv = autoPairedVehicles[i];
    autoWeighmentsToInsert.push({
      in_entry_id: createdAutoIn[i].id,
      out_entry_id: createdAutoOut[i].id,
      unit: "kg",
      type: i % 4 === 0 ? "out" : i % 7 === 0 ? "unassigned" : "in",
      created_at: daysAgo(pv.daysOffset, pv.minutesOffset),
    });
  }

  const { data: createdAutoWeighments, error: autoWeighmentErr } = await supabase
    .from("automatic_weighments")
    .insert(autoWeighmentsToInsert)
    .select("id");

  if (autoWeighmentErr || !createdAutoWeighments) {
    throw autoWeighmentErr || new Error("Failed to bulk insert automatic weighments");
  }

  // Create linked manual weighments
  const manualWeighmentsToInsert: WeighmentInsert[] = [];
  for (let i = 0; i < createdManualIn.length; i++) {
    const pv = manualPairedVehicles[i];
    manualWeighmentsToInsert.push({
      in_entry_id: createdManualIn[i].id,
      out_entry_id: createdManualOut[i].id,
      unit: "kg",
      type: i % 4 === 0 ? "out" : i % 7 === 0 ? "unassigned" : "in",
      created_at: daysAgo(pv.daysOffset, pv.minutesOffset),
    });
  }

  const { data: createdManualWeighments, error: manualWeighmentErr } = await supabase
    .from("manual_weighments")
    .insert(manualWeighmentsToInsert)
    .select("id");

  if (manualWeighmentErr || !createdManualWeighments) {
    throw manualWeighmentErr || new Error("Failed to bulk insert manual weighments");
  }

  console.log(
    `  ✓ Created ${createdAutoWeighments.length} automatic weighments and ${createdManualWeighments.length} manual weighments.`,
  );

  // 7. STANDALONE UNPAIRED ENTRIES (50 Entries: 25 Automatic, 25 Manual)
  console.log("\n📋 [6/7] Seeding 50 Standalone Entries (25 Automatic, 25 Manual)...");

  const autoStandaloneToInsert: AutomaticEntryInsert[] = [];
  const manualStandaloneToInsert: ManualEntryInsert[] = [];

  // 25 Automatic Standalone Entries (15 Main Weighbridge, 10 other Factory 1 centers)
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

  const { data: createdAutoStandalone, error: autoStandaloneErr } = await supabase
    .from("automatic_entries")
    .insert(autoStandaloneToInsert)
    .select("id, center_id, device_id");

  if (autoStandaloneErr || !createdAutoStandalone) {
    throw autoStandaloneErr || new Error("Failed to bulk insert automatic standalone entries");
  }

  // 25 Manual Standalone Entries (10 Main Weighbridge, 5 other Factory 1, 10 Factory 2)
  for (let i = 16; i <= 25; i++) {
    const plate = `DL01XY${3000 + i}`;
    const customerId = i % 4 === 0 ? null : customerIdsArray[i % 35];
    const operatorId = i % 2 === 0 ? operator1Id : operator3Id;

    manualStandaloneToInsert.push({
      vehicle_number: plate,
      weight: 16000 + ((i * 1250) % 28000),
      center_id: mainWeighbridgeId,
      customer_id: customerId,
      created_by: operatorId,
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
      created_by: operator1Id,
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
      created_by: operator2Id,
      images: [],
      created_at: daysAgo(8 + i, (i * 50) % 60),
    });
  }

  const { data: createdManualStandalone, error: manualStandaloneErr } = await supabase
    .from("manual_entries")
    .insert(manualStandaloneToInsert)
    .select("id, center_id");

  if (manualStandaloneErr || !createdManualStandalone) {
    throw manualStandaloneErr || new Error("Failed to bulk insert manual standalone entries");
  }

  console.log(
    `  ✓ Created ${createdAutoStandalone.length} automatic standalone entries and ${createdManualStandalone.length} manual standalone entries.`,
  );

  // 8. TICKETS (40 Support Tickets: 20 Automatic, 20 Manual)
  console.log("\n🎫 [7/7] Seeding 40 Support Tickets (20 Automatic, 20 Manual)...");
  interface AutomaticTicketInsert {
    concern: string;
    reply: string | null;
    status: TicketStatus;
    entry_id: number | null;
    weighment_id: number | null;
    user_id: number;
    device_id: number | null;
    created_at: string;
  }

  interface ManualTicketInsert {
    concern: string;
    reply: string | null;
    status: TicketStatus;
    entry_id: number | null;
    weighment_id: number | null;
    user_id: number;
    created_at: string;
  }

  const ticketConcerns = [
    {
      concern: "Vehicle plate mismatch with transport manifest.",
      reply: "Verified physical gate register; operator corrected plate.",
      status: "approved" as TicketStatus,
    },
    {
      concern: "Tare weight discrepancy exceeds allowed ±20kg tolerance margin.",
      reply: "Recalibrated weighbridge and re-verified tare weight.",
      status: "approved" as TicketStatus,
    },
    {
      concern: "Driver disputed net weight recorded on outbound receipt.",
      reply: null,
      status: "pending" as TicketStatus,
    },
    {
      concern: "Camera 1 crop obscured by mud spatter on lens.",
      reply: "Cleaned optical sensor housing; test frame verified.",
      status: "approved" as TicketStatus,
    },
    {
      concern: "Moisture rebate query from farmer on grain shipment.",
      reply: null,
      status: "pending" as TicketStatus,
    },
    {
      concern: "Gross weight exceeds legal highway payload rating (50MT).",
      reply: "Excess cargo offloaded at auxiliary depot prior to transit.",
      status: "approved" as TicketStatus,
    },
    {
      concern: "Scale indicator oscillated due to high crosswinds.",
      reply: "Wind deflectors inspected and tightened.",
      status: "approved" as TicketStatus,
    },
    {
      concern: "OCR failed to read obscured rear number plate.",
      reply: null,
      status: "pending" as TicketStatus,
    },
    {
      concern: "Entry submitted with incorrect commodity destination center.",
      reply: "Re-routed shipment to Silo Unit 2.",
      status: "approved" as TicketStatus,
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
      status: "approved" as TicketStatus,
    },
    {
      concern: "Customer account mapping missing on delivery challan.",
      reply: null,
      status: "pending" as TicketStatus,
    },
    {
      concern: "Axle sensor trigger skipped second trailer axle.",
      reply: "Multi-axle bridge sequencing sensor adjusted.",
      status: "approved" as TicketStatus,
    },
    {
      concern: "Driver requested duplicate printed receipt copy.",
      reply: "Reprint issued with duplicate watermark.",
      status: "approved" as TicketStatus,
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
      concern: "Customer disputed commodity deduction grade.",
      reply: "Quality control lab sample re-tested; confirmed grade B.",
      status: "rejected" as TicketStatus,
    },
    {
      concern: "Weighbridge surface debris accumulation warning.",
      reply: "Platform power-washed and inspected for zero stability.",
      status: "approved" as TicketStatus,
    },
  ];

  const autoTicketsToInsert: AutomaticTicketInsert[] = [];
  const manualTicketsToInsert: ManualTicketInsert[] = [];

  // 10 Automatic Tickets linked to automatic standalone entries
  for (let i = 0; i < 10; i++) {
    const entry = createdAutoStandalone[i];
    const template = ticketConcerns[i % ticketConcerns.length];
    autoTicketsToInsert.push({
      concern: template.concern,
      reply: template.reply,
      status: template.status,
      entry_id: entry.id,
      weighment_id: null,
      user_id: i % 2 === 0 ? operator1Id : manager1Id,
      device_id: entry.device_id,
      created_at: daysAgo(10 - Math.floor(i / 2), (i * 20) % 60),
    });
  }

  // 10 Automatic Tickets linked to automatic weighments
  for (let i = 0; i < 10; i++) {
    const weighment = createdAutoWeighments[i];
    const template = ticketConcerns[(i + 5) % ticketConcerns.length];
    autoTicketsToInsert.push({
      concern: `[Automatic Weighment #${weighment.id}] ${template.concern}`,
      reply: template.reply,
      status: template.status,
      entry_id: null,
      weighment_id: weighment.id,
      user_id: i % 2 === 0 ? manager1Id : operator1Id,
      device_id: null,
      created_at: daysAgo(15 - Math.floor(i / 2), (i * 25) % 60),
    });
  }

  const { data: createdAutoTickets, error: autoTicketErr } = await supabase
    .from("automatic_tickets")
    .insert(autoTicketsToInsert)
    .select("id");

  if (autoTicketErr || !createdAutoTickets) {
    throw autoTicketErr || new Error("Failed to bulk insert automatic tickets");
  }

  // 10 Manual Tickets linked to manual standalone entries
  for (let i = 0; i < 10; i++) {
    const entry = createdManualStandalone[i];
    const template = ticketConcerns[i % ticketConcerns.length];
    manualTicketsToInsert.push({
      concern: template.concern,
      reply: template.reply,
      status: template.status,
      entry_id: entry.id,
      weighment_id: null,
      user_id: i % 2 === 0 ? operator1Id : manager1Id,
      created_at: daysAgo(10 - Math.floor(i / 2), (i * 20) % 60),
    });
  }

  // 10 Manual Tickets linked to manual weighments
  for (let i = 0; i < 10; i++) {
    const weighment = createdManualWeighments[i];
    const template = ticketConcerns[(i + 5) % ticketConcerns.length];
    manualTicketsToInsert.push({
      concern: `[Manual Weighment #${weighment.id}] ${template.concern}`,
      reply: template.reply,
      status: template.status,
      entry_id: null,
      weighment_id: weighment.id,
      user_id: i % 2 === 0 ? manager1Id : operator1Id,
      created_at: daysAgo(15 - Math.floor(i / 2), (i * 25) % 60),
    });
  }

  const { data: createdManualTickets, error: manualTicketErr } = await supabase
    .from("manual_tickets")
    .insert(manualTicketsToInsert)
    .select("id");

  if (manualTicketErr || !createdManualTickets) {
    throw manualTicketErr || new Error("Failed to bulk insert manual tickets");
  }

  console.log(
    `  ✓ Seeded ${createdAutoTickets.length} automatic tickets and ${createdManualTickets.length} manual tickets.`,
  );

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
  console.log(`  • Automatic Tickets:    ${createdAutoTickets.length} (10 entries, 10 weighments)`);
  console.log(
    `  • Manual Tickets:       ${createdManualTickets.length} (10 entries, 10 weighments)`,
  );
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
