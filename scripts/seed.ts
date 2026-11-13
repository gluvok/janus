/**
 * @file scripts/seed.ts
 * @description Client onboarding seed script for GluVok strictly adhering to schema.sql.
 * Provisions core infrastructure required to onboard a new client:
 * 1. A new Factory (with receipt_images_per_row constraint validation: 1-6)
 * 2. A new Admin user (dynamically numbered based on existing admins)
 * 3. Centers for the new factory with dedicated API keys
 */

import crypto from "node:crypto";
import argon2 from "argon2";
import { z } from "zod";
import { SUPABASE_URL, supabase } from "./supabase.ts";

const cliOptionsSchema = z.object({
  factory: z.string().trim().min(1).optional(),
  receipt_images_per_row: z.coerce
    .number()
    .int("Images per row must be an integer")
    .min(1, "Images per row must be at least 1")
    .max(6, "Images per row must be at most 6")
    .default(3),
  centers: z.coerce
    .number()
    .int("Centers count must be an integer")
    .min(1, "Centers count must be at least 1")
    .default(1),
  center_names: z
    .string()
    .transform((val) =>
      val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .optional(),
  admin_password: z
    .string()
    .min(4, "Admin password must be at least 4 characters")
    .default("admin123"),
  help: z.boolean().default(false),
});

type CliOptions = z.infer<typeof cliOptionsSchema>;

function parseCliArgs(argv: string[]): CliOptions {
  const raw: Record<string, unknown> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      raw.help = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-/g, "_");
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        raw[key] = next;
        i++;
      } else {
        raw[key] = true;
      }
    }
  }

  const result = cliOptionsSchema.safeParse(raw);
  if (!result.success) {
    console.error("❌ Invalid CLI arguments:");
    for (const issue of result.error.issues) {
      console.error(`   • --${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

function printHelp() {
  console.log(`
Client Onboarding Seeder (scripts/seed.ts)

Provisions the minimal required entities to onboard a new client strictly adhering to schema.sql:
  • 1 New Factory (receipt_images_per_row: 1 to 6)
  • 1 New Admin user (username auto-indexed from current admin count)
  • N New Centers with dedicated API keys and unique factory constraints

Usage:
  pnpm run seed [options]

Options:
  --factory <name>                 Custom name for the factory (default: 'Factory <N>')
  --receipt-images-per-row <1-6>   Images per row on receipts between 1 and 6 (default: 3)
  --centers <count>                Number of centers to create (default: 1)
  --center-names <names>           Comma-separated center names (e.g. 'Terminal A,Terminal B')
  --admin-password <pass>          Admin password (default: 'admin123')
  -h, --help                       Show this help guide

Examples:
  pnpm run seed
  pnpm run seed --factory "Apex Agro" --centers 2
  pnpm run seed --factory "Delta Grain" --center-names "Main Weighbridge,North Scale" --receipt-images-per-row 4
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
  console.log(`📡 Supabase Endpoint: ${SUPABASE_URL}`);
  console.log("=================================================");

  // 1. QUERY EXISTING DATA COUNTS & SUFFIXES IN SINGLE BATCH
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

  const factoryName = args.factory ?? `Factory ${nextFactoryNum}`;
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
    `\n🏭 Creating factory '${factoryName}' (receipt images per row: ${args.receipt_images_per_row})...`,
  );
  const { data: createdFactory, error: factoryError } = await supabase
    .from("factories")
    .insert({
      name: factoryName,
      receipt_images_per_row: args.receipt_images_per_row,
    })
    .select("id, name")
    .single();

  if (factoryError || !createdFactory) {
    throw factoryError;
  }
  console.log(`  ✓ Factory created (ID: ${createdFactory.id}, Name: '${createdFactory.name}')`);

  // 3. CREATE ADMIN USER
  console.log(`\n👤 Provisioning admin user '${adminUsername}'...`);
  const adminHash = await argon2.hash(args.admin_password);
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

  // 4. CREATE CENTERS WITH API KEYS IN O(1) BULK INSERT
  console.log(`\n⚖️ Provisioning ${args.centers} center(s) with dedicated API keys...`);

  const centersToInsert = Array.from({ length: args.centers }, (_, i) => {
    const centerIndex = i + 1;
    const centerName =
      args.center_names && args.center_names[i] ? args.center_names[i] : `Center ${centerIndex}`;
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
    `  • Admin:     ${createdAdmin.username} / ${args.admin_password} (ID: ${createdAdmin.id})`,
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
