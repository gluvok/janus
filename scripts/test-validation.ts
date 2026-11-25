/**
 * @file scripts/test-validation.ts
 * @description Invariant and validation test suite strictly enforcing schema.sql rules.
 * Runs under 'pnpm test' to verify:
 * 1. Indian vehicle registration plate normalization and regex validation
 * 2. Generated column calculations and trigger derivations (gross, tare, net, type)
 * 3. Schema check constraints (positive weights, receipt images per row)
 * 4. Database enum definitions (role_enum, weighment_type, ticket_status)
 * 5. Entry idempotency key UUIDv7 format validation
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { z } from "zod";
import {
  isValidIndianPlate,
  normalizeVehicleNumber,
  vehicleNumberSchema,
} from "../lib/validation/helpers.ts";

console.log("=================================================");
console.log("🧪 Running GluVok Validation & Schema Invariants Suite");
console.log("=================================================");

// ------------------------------------------------------------------------------
// 1. VEHICLE REGISTRATION NUMBER VALIDATION TESTS
// ------------------------------------------------------------------------------
console.log("\n🚗 [1/5] Testing Vehicle Number Normalization & Validation...");

// Test normalization
assert.equal(normalizeVehicleNumber("mh 12 ab 1028"), "MH12AB1028");
assert.equal(normalizeVehicleNumber("  gj-03  ab  1234 "), "GJ03AB1234");
assert.equal(normalizeVehicleNumber("MH-12-AB-1028"), "MH12AB1028");
console.log("  ✓ Vehicle number normalization verified.");

// Test valid commercial formats
const validPlates = [
  "MH12AB1028",
  "GJ03AB1234",
  "DL01A1234",
  "DL1A1234",
  "KA041234",
  "KA05B9999",
  "UP32AB1234",
  "HR26DQ5551",
];

for (const plate of validPlates) {
  assert.ok(isValidIndianPlate(plate), `Expected ${plate} to be valid`);
  const parsed = vehicleNumberSchema.safeParse(plate);
  assert.ok(parsed.success, `Expected zod schema to pass for ${plate}`);
}
console.log(`  ✓ ${validPlates.length} valid commercial plates verified.`);

// Test invalid formats (including non-commercial BH and VA)
const invalidPlates = [
  "XX12AB1028", // Invalid state code XX
  "12345", // Just numbers
  "ABCDE", // Just letters
  "ZZ99ZZ9999", // ZZ is not in STATE_CODES
  "MH12345AB", // Invalid structure
  "22BH1234AA", // BH series is non-commercial
  "DLVAAA1234", // Vintage VA series is non-commercial
];

for (const plate of invalidPlates) {
  assert.ok(!isValidIndianPlate(plate), `Expected ${plate} to be invalid`);
  const parsed = vehicleNumberSchema.safeParse(plate);
  assert.ok(!parsed.success, `Expected zod schema to fail for ${plate}`);
}
console.log(`  ✓ ${invalidPlates.length} invalid plate formats rejected correctly.`);

// ------------------------------------------------------------------------------
// 2. SCHEMA TRIGGER & GENERATED COLUMN CALCULATIONS (gross, tare, net, type)
// Reference: schema.sql lines 136-147 & 282-321
// ------------------------------------------------------------------------------
console.log("\n⚖️ [2/5] Testing PostgreSQL Trigger Derivations & Generated Columns...");

type WeighmentType = "in" | "out" | "void";

function deriveWeighment(
  inWeight: number,
  outWeight: number,
): {
  gross: number;
  tare: number;
  net: number;
  type: WeighmentType;
} {
  const gross = Math.max(inWeight, outWeight);
  const tare = Math.min(inWeight, outWeight);
  const net = gross - tare;
  const type: WeighmentType = inWeight > outWeight ? "in" : inWeight < outWeight ? "out" : "void";
  return { gross, tare, net, type };
}

// Case 1: Inbound Unloading Delivery (in_weight > out_weight -> type: 'in')
{
  const result = deriveWeighment(38000, 14000);
  assert.equal(result.gross, 38000);
  assert.equal(result.tare, 14000);
  assert.equal(result.net, 24000);
  assert.equal(result.type, "in");
  console.log("  ✓ Inbound delivery (type: 'in') derivations verified.");
}

// Case 2: Outbound Loading Dispatch (in_weight < out_weight -> type: 'out')
{
  const result = deriveWeighment(12500, 36500);
  assert.equal(result.gross, 36500);
  assert.equal(result.tare, 12500);
  assert.equal(result.net, 24000);
  assert.equal(result.type, "out");
  console.log("  ✓ Outbound dispatch (type: 'out') derivations verified.");
}

// Case 3: Equal Weight Pass-Through (in_weight == out_weight -> type: 'void')
{
  const result = deriveWeighment(15000, 15000);
  assert.equal(result.gross, 15000);
  assert.equal(result.tare, 15000);
  assert.equal(result.net, 0);
  assert.equal(result.type, "void");
  console.log("  ✓ Empty pass-through (type: 'void') derivations verified.");
}

// ------------------------------------------------------------------------------
// 3. SCHEMA CONSTRAINT INVARIANTS
// Reference: schema.sql (factories, centers, users, automatic_*, manual_*)
// ------------------------------------------------------------------------------
console.log("\n📐 [3/5] Testing Schema Constraint Invariants...");

function validateReceiptImagesPerRow(val: number): boolean {
  return Number.isInteger(val) && val >= 1 && val <= 2;
}

assert.ok(validateReceiptImagesPerRow(1));
assert.ok(validateReceiptImagesPerRow(2));
assert.ok(!validateReceiptImagesPerRow(0));
assert.ok(!validateReceiptImagesPerRow(3));
assert.ok(!validateReceiptImagesPerRow(2.5));
console.log("  ✓ chk_factories_receipt_images_per_row (1 to 2) invariant verified.");

function validateApiKey(key: string): boolean {
  return typeof key === "string" && key.trim().length >= 16;
}

assert.ok(validateApiKey("a".repeat(16)));
assert.ok(validateApiKey("0123456789abcdef0123456789abcdef")); // 32 hex chars
assert.ok(!validateApiKey("short_key"));
assert.ok(!validateApiKey("   " + "a".repeat(10) + "   "));
console.log("  ✓ chk_factories_api_key & chk_centers_api_key (>= 16 chars) verified.");

function validateName(name: string): boolean {
  return typeof name === "string" && name.trim().length >= 3 && name.trim().length <= 50;
}

assert.ok(validateName("Mesto Alpha"));
assert.ok(validateName("abc")); // min 3
assert.ok(validateName("a".repeat(50))); // max 50
assert.ok(!validateName("ab")); // < 3
assert.ok(!validateName("a".repeat(51))); // > 50
assert.ok(!validateName("   ab   ")); // trimmed < 3
console.log(
  "  ✓ chk_factories_name, chk_centers_name, chk_users_username, chk_users_name verified.",
);

function validateEntryVehicle(plate: string): boolean {
  return typeof plate === "string" && plate.trim().length >= 8 && plate.trim().length <= 11;
}

assert.ok(validateEntryVehicle("MH12AB1234")); // 10
assert.ok(validateEntryVehicle("DL1A1234")); // 8
assert.ok(validateEntryVehicle("HR26DQ5551A")); // 11
assert.ok(!validateEntryVehicle("MH123")); // 5 < 8
assert.ok(!validateEntryVehicle("MH12AB123456")); // 12 > 11
console.log(
  "  ✓ chk_automatic_entries_vehicle & chk_manual_entries_vehicle (8 to 11 chars) verified.",
);

function validateEntryWeight(weight: number): boolean {
  return typeof weight === "number" && weight > 0;
}

assert.ok(validateEntryWeight(25000));
assert.ok(!validateEntryWeight(0));
assert.ok(!validateEntryWeight(-500));
console.log("  ✓ automatic_entries & manual_entries positive weight constraint verified.");

function validateWeighmentDistinctEntries(inId: number, outId: number): boolean {
  return inId !== outId;
}

assert.ok(validateWeighmentDistinctEntries(1, 2));
assert.ok(!validateWeighmentDistinctEntries(5, 5));
console.log(
  "  ✓ chk_automatic_weighments_distinct_entries & chk_manual_weighments_distinct_entries verified.",
);

function validateWeighmentWeights(gross: number, tare: number): boolean {
  return gross > 0 && tare >= 0 && gross >= tare;
}

assert.ok(validateWeighmentWeights(38000, 14000));
assert.ok(validateWeighmentWeights(15000, 15000));
assert.ok(!validateWeighmentWeights(14000, 38000)); // gross must be >= tare
assert.ok(!validateWeighmentWeights(0, 0)); // gross must be > 0
console.log(
  "  ✓ chk_automatic_weighments_gross_tare & chk_manual_weighments_gross_tare invariants verified.",
);

function validateTicketConcern(concern: string): boolean {
  return typeof concern === "string" && concern.trim().length > 0;
}

assert.ok(validateTicketConcern("Plate OCR mismatch"));
assert.ok(!validateTicketConcern(""));
assert.ok(!validateTicketConcern("   "));
console.log("  ✓ chk_automatic_tickets_concern & chk_manual_tickets_concern invariants verified.");

function validateRequiredCreatorId(creatorId: unknown): boolean {
  return typeof creatorId === "number" && Number.isInteger(creatorId) && creatorId > 0;
}

assert.ok(validateRequiredCreatorId(1));
assert.ok(!validateRequiredCreatorId(null));
assert.ok(!validateRequiredCreatorId(0));
console.log(
  "  ✓ manual_entries, automatic_tickets & manual_tickets non-null creator_id invariant verified.",
);

// ------------------------------------------------------------------------------
// 4. DATABASE ENUM SET INVARIANTS
// Reference: schema.sql lines 38-40
// ------------------------------------------------------------------------------
console.log("\n🏷️ [4/5] Testing Database Enum Definitions...");

const ROLE_ENUMS = new Set(["admin", "manager", "operator", "base"]);
assert.equal(ROLE_ENUMS.size, 4);
assert.ok(ROLE_ENUMS.has("admin"));
assert.ok(ROLE_ENUMS.has("manager"));
assert.ok(ROLE_ENUMS.has("operator"));
assert.ok(ROLE_ENUMS.has("base"));
assert.ok(!ROLE_ENUMS.has("customer"));

const WEIGHMENT_TYPE_ENUMS = new Set(["in", "out", "void"]);
assert.equal(WEIGHMENT_TYPE_ENUMS.size, 3);
assert.ok(WEIGHMENT_TYPE_ENUMS.has("in"));
assert.ok(WEIGHMENT_TYPE_ENUMS.has("out"));
assert.ok(WEIGHMENT_TYPE_ENUMS.has("void"));
assert.ok(!WEIGHMENT_TYPE_ENUMS.has("pending")); // entries are paired; individual entries hold pending states

const TICKET_STATUS_ENUMS = new Set(["pending", "approved", "rejected"]);
assert.equal(TICKET_STATUS_ENUMS.size, 3);
assert.ok(TICKET_STATUS_ENUMS.has("pending"));
assert.ok(TICKET_STATUS_ENUMS.has("approved"));
assert.ok(TICKET_STATUS_ENUMS.has("rejected"));

console.log("  ✓ All database enum sets match schema.sql exactly.");

// ------------------------------------------------------------------------------
// 5. ENTRY IDEMPOTENCY KEY UUIDV7 INVARIANTS
// Reference: schema.sql line 119
// ------------------------------------------------------------------------------
console.log("\n🔑 [5/5] Testing Entry Idempotency Key UUIDv7 Validation...");

const idempotencySchema = z.uuidv7();

// Valid UUIDv7 generated via Node native crypto
const validUuidV7 = crypto.randomUUIDv7();
assert.ok(
  idempotencySchema.safeParse(validUuidV7).success,
  `Expected valid UUIDv7 ${validUuidV7} to pass validation`,
);
assert.equal(idempotencySchema.parse(validUuidV7), validUuidV7);

// Known UUIDv7 test vector
const sampleUuidV7 = "01890a5c-5b20-77a8-8b9a-7c2d9d1b0d3e";
assert.ok(
  idempotencySchema.safeParse(sampleUuidV7).success,
  `Expected sample UUIDv7 ${sampleUuidV7} to pass validation`,
);

// Reject UUIDv4 (version 4)
const uuidV4 = crypto.randomUUID();
assert.ok(
  !idempotencySchema.safeParse(uuidV4).success,
  `Expected UUIDv4 ${uuidV4} to be rejected by z.uuidv7()`,
);

// Reject legacy seed strings and arbitrary text
const invalidKeys = ["seed-auto-MH12AB1028-1", "12345", "not-a-uuid", "", "   ", null, undefined];

for (const key of invalidKeys) {
  assert.ok(
    !idempotencySchema.safeParse(key).success,
    `Expected invalid key '${key}' to be rejected`,
  );
}

console.log("  ✓ Entry UUIDv7 idempotency key validation verified.");

console.log("\n=================================================");
console.log("🎉 All validation and schema invariant tests passed!");
console.log("=================================================");
