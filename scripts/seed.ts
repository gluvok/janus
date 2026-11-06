/**
 * @file scripts/seed.ts
 * @description Client onboarding seed script for GluVok.
 * Provisions core infrastructure required to onboard a new client:
 * 1. A new Factory
 * 2. A new Admin user (dynamically numbered based on existing admins)
 * 3. Centers for the new factory with dedicated API keys
 */

import crypto from "node:crypto";
import argon2 from "argon2";
import { supabase } from "./supabase.ts";

interface ParsedArgs {
  factoryName?: string;
  receiptImagesPerRow: number;
  centersCount: number;
  centerNames?: string[];
  adminPassword: string;
  help?: boolean;
}

function parseCliArgs(args: string[]): ParsedArgs {
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    }
  }

  const centersCount =
    typeof options.centers === "string" ? Math.max(1, parseInt(options.centers, 10) || 1) : 1;

  let centerNames: string[] | undefined;
  if (typeof options["center-names"] === "string") {
    centerNames = options["center-names"]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  let receiptImagesPerRow = 3;
  if (typeof options["receipt-images-per-row"] === "string") {
    const val = parseInt(options["receipt-images-per-row"], 10);
    if (val >= 1 && val <= 6) {
      receiptImagesPerRow = val;
    } else {
      console.warn("⚠️ --receipt-images-per-row must be between 1 and 6. Using default: 3.");
    }
  }

  return {
    factoryName: typeof options.factory === "string" ? options.factory.trim() : undefined,
    receiptImagesPerRow,
    centersCount,
    centerNames,
    adminPassword:
      typeof options["admin-password"] === "string" ? options["admin-password"] : "admin123",
    help: !!options.help,
  };
}

function printHelp() {
  console.log(`
Client Onboarding Seeder (scripts/seed.ts)

Provisions the minimal required entities to onboard a new client:
  • 1 New Factory
  • 1 New Admin user (username auto-indexed from current admin count)
  • N New Centers with dedicated API keys

Usage:
  pnpm run seed [options]

Options:
  --factory <name>            Custom name for the factory (default: 'Factory <N>')
  --receipt-images-per-row <N> Images per row on receipts between 1 and 6 (default: 3)
  --centers <count>           Number of centers to create (default: 1)
  --center-names <names>      Comma-separated center names (e.g. 'Terminal A,Terminal B')
  --admin-password <pass>     Admin password (default: 'admin123')
  -h, --help                  Show this help guide

Examples:
  pnpm run seed
  pnpm run seed --factory "Apex Agro" --centers 2
  pnpm run seed --factory "Delta Grain" --center-names "Main Weighbridge,North Scale"
`);
}

function getNextSuffix(existingValues: string[], pattern: RegExp, fallbackCount: number): number {
  let max = 0;
  for (const val of existingValues) {
    const match = val.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return Math.max(max + 1, fallbackCount + 1);
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  console.log("=================================================");
  console.log("🚀 Mesto Client Onboarding Seeder");
  console.log(`📡 Supabase Endpoint: ${process.env.SUPABASE_URL}`);
  console.log("=================================================");

  // 1. QUERY EXISTING DATA COUNTS & SUFFIXES
  console.log("\n🔍 Inspecting existing database state...");

  const [factoriesRes, adminsRes] = await Promise.all([
    supabase.from("factories").select("id, name"),
    supabase.from("users").select("id, username").eq("role", "admin"),
  ]);

  if (factoriesRes.error) throw factoriesRes.error;
  if (adminsRes.error) throw adminsRes.error;

  const existingFactories = factoriesRes.data ?? [];
  const existingAdmins = adminsRes.data ?? [];

  const nextFactoryNum = getNextSuffix(
    existingFactories.map((f) => f.name),
    /^Factory\s+(\d+)$/i,
    existingFactories.length,
  );

  const nextAdminNum = getNextSuffix(
    existingAdmins.map((u) => u.username),
    /^admin(\d+)$/i,
    existingAdmins.length,
  );

  const factoryName = args.factoryName || `Factory ${nextFactoryNum}`;
  const adminUsername = `admin${nextAdminNum}`;
  const adminName = `Admin ${factoryName}`;

  console.log(
    `  • Existing Factories: ${existingFactories.length} → Next Factory: '${factoryName}'`,
  );
  console.log(
    `  • Existing Admins:    ${existingAdmins.length} → Next Admin:   '${adminUsername}'`,
  );

  // 2. CREATE FACTORY
  console.log(
    `\n🏭 Creating factory '${factoryName}' (receipt images per row: ${args.receiptImagesPerRow})...`,
  );
  const { data: createdFactory, error: factoryError } = await supabase
    .from("factories")
    .insert({ name: factoryName, receipt_images_per_row: args.receiptImagesPerRow })
    .select("id, name")
    .single();

  if (factoryError || !createdFactory) {
    throw factoryError;
  }
  console.log(`  ✓ Factory created (ID: ${createdFactory.id}, Name: '${createdFactory.name}')`);

  // 3. CREATE ADMIN USER
  console.log(`\n👤 Provisioning admin user '${adminUsername}'...`);
  const adminHash = await argon2.hash(args.adminPassword);
  const { data: createdAdmin, error: adminError } = await supabase
    .from("users")
    .insert({
      username: adminUsername,
      name: adminName,
      role: "admin",
      password_hash: adminHash,
      factory_id: createdFactory.id,
    })
    .select("id, username")
    .single();

  if (adminError || !createdAdmin) {
    throw adminError || new Error(`Failed to create admin user ${adminUsername}`);
  }
  console.log(
    `  ✓ Admin user created (ID: ${createdAdmin.id}, Username: '${createdAdmin.username}')`,
  );

  // 4. CREATE CENTERS WITH API KEYS
  console.log(`\n⚖️ Provisioning ${args.centersCount} center(s) with dedicated API keys...`);

  const centersToInsert = Array.from({ length: args.centersCount }, (_, i) => {
    const centerIndex = i + 1;
    const centerName =
      args.centerNames && args.centerNames[i] ? args.centerNames[i] : `Center ${centerIndex}`;
    const apiKey = crypto.randomBytes(16).toString("hex");
    return {
      name: centerName,
      factory_id: createdFactory.id,
      api_key: apiKey,
    };
  });

  const { data: createdCenters, error: centersError } = await supabase
    .from("centers")
    .insert(centersToInsert)
    .select("id, name, api_key");

  if (centersError || !createdCenters) {
    throw centersError || new Error("Failed to bulk create centers");
  }

  for (const center of createdCenters) {
    console.log(`  ✓ Center '${center.name}' (ID: ${center.id}, API Key: ${center.api_key})`);
  }

  // 5. SUMMARY
  console.log("\n=================================================");
  console.log("🎉 Client Onboarding Completed Successfully!");
  console.log("=================================================");
  console.log("📋 Summary of Provisioned Resources:");
  console.log(`  • Factory:   ${createdFactory.name} (ID: ${createdFactory.id})`);
  console.log(
    `  • Admin:     ${createdAdmin.username} / ${args.adminPassword} (ID: ${createdAdmin.id})`,
  );
  console.log("  • Centers & Scale API Keys:");
  for (const center of createdCenters) {
    console.log(`    - ${center.name} (ID: ${center.id}) ➜ API Key: ${center.api_key}`);
  }
  console.log("=================================================");
}

main().catch((err) => {
  console.error("❌ Onboarding seeding failed:", err);
  process.exit(1);
});
