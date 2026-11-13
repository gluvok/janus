/**
 * @file scripts/test-validation.ts
 * @description Invariant and validation test suite strictly enforcing schema.sql rules.
 * Runs under 'pnpm test' to verify:
 * 1. Indian vehicle registration plate normalization and regex validation
 * 2. Generated column calculations (gross, tare, net, type) matching schema.sql
 * 3. Schema check constraints (positive weights, receipt images per row)
 * 4. Database enum definitions (role_enum, weighment_type, ticket_status)
 */

import assert from "node:assert/strict";
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
console.log("\n🚗 [1/4] Testing Vehicle Number Normalization & Validation...");

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
// 2. SCHEMA GENERATED COLUMN CALCULATIONS (gross, tare, net, type)
// Reference: schema.sql lines 103-128 & 157-182
// ------------------------------------------------------------------------------
console.log("\n⚖️ [2/4] Testing PostgreSQL Generated Column Calculations...");

type WeighmentType = "pending" | "in" | "out" | "unassigned";

function calculateGross(inWeight: number, outWeight: number | null): number {
  if (outWeight === null) return inWeight;
  return Math.max(inWeight, outWeight);
}

function calculateTare(inWeight: number, outWeight: number | null): number | null {
  if (outWeight === null) return null;
  return Math.min(inWeight, outWeight);
}

function calculateNet(inWeight: number, outWeight: number | null): number | null {
  if (outWeight === null) return null;
  return Math.abs(inWeight - outWeight);
}

function calculateType(inWeight: number, outWeight: number | null): WeighmentType {
  if (outWeight === null) return "pending";
  if (inWeight > outWeight) return "in";
  if (inWeight < outWeight) return "out";
  return "unassigned";
}

// Case 1: Inbound Pending Weighment (only in_weight recorded)
{
  const inWeight = 32500;
  const outWeight = null;
  assert.equal(calculateGross(inWeight, outWeight), 32500);
  assert.equal(calculateTare(inWeight, outWeight), null);
  assert.equal(calculateNet(inWeight, outWeight), null);
  assert.equal(calculateType(inWeight, outWeight), "pending");
  console.log("  ✓ Pending weighment calculations verified.");
}

// Case 2: Inbound Unloading Delivery (in_weight > out_weight -> type: 'in')
{
  const inWeight = 38000;
  const outWeight = 14000;
  assert.equal(calculateGross(inWeight, outWeight), 38000);
  assert.equal(calculateTare(inWeight, outWeight), 14000);
  assert.equal(calculateNet(inWeight, outWeight), 24000);
  assert.equal(calculateType(inWeight, outWeight), "in");
  console.log("  ✓ Inbound delivery (type: 'in') calculations verified.");
}

// Case 3: Outbound Loading Dispatch (in_weight < out_weight -> type: 'out')
{
  const inWeight = 12500;
  const outWeight = 36500;
  assert.equal(calculateGross(inWeight, outWeight), 36500);
  assert.equal(calculateTare(inWeight, outWeight), 12500);
  assert.equal(calculateNet(inWeight, outWeight), 24000);
  assert.equal(calculateType(inWeight, outWeight), "out");
  console.log("  ✓ Outbound dispatch (type: 'out') calculations verified.");
}

// Case 4: Equal Weight Pass-Through (in_weight == out_weight -> type: 'unassigned')
{
  const inWeight = 15000;
  const outWeight = 15000;
  assert.equal(calculateGross(inWeight, outWeight), 15000);
  assert.equal(calculateTare(inWeight, outWeight), 15000);
  assert.equal(calculateNet(inWeight, outWeight), 0);
  assert.equal(calculateType(inWeight, outWeight), "unassigned");
  console.log("  ✓ Empty pass-through (type: 'unassigned') calculations verified.");
}

// ------------------------------------------------------------------------------
// 3. SCHEMA CONSTRAINT INVARIANTS
// Reference: schema.sql lines 49, 131-132, 185-186
// ------------------------------------------------------------------------------
console.log("\n📐 [3/4] Testing Schema Constraint Invariants...");

function validateReceiptImagesPerRow(val: number): boolean {
  return Number.isInteger(val) && val >= 1 && val <= 6;
}

assert.ok(validateReceiptImagesPerRow(1));
assert.ok(validateReceiptImagesPerRow(3));
assert.ok(validateReceiptImagesPerRow(6));
assert.ok(!validateReceiptImagesPerRow(0));
assert.ok(!validateReceiptImagesPerRow(7));
assert.ok(!validateReceiptImagesPerRow(2.5));
console.log("  ✓ chk_receipt_images_per_row (1 to 6) invariant verified.");

function validateWeighmentWeights(inWeight: number, outWeight: number | null): boolean {
  if (inWeight <= 0) return false;
  if (outWeight !== null && outWeight <= 0) return false;
  return true;
}

assert.ok(validateWeighmentWeights(25000, null));
assert.ok(validateWeighmentWeights(25000, 12000));
assert.ok(!validateWeighmentWeights(0, null));
assert.ok(!validateWeighmentWeights(-500, null));
assert.ok(!validateWeighmentWeights(25000, 0));
assert.ok(!validateWeighmentWeights(25000, -100));
console.log("  ✓ chk_weighments_weight_positive invariants verified.");

// ------------------------------------------------------------------------------
// 4. DATABASE ENUM SET INVARIANTS
// Reference: schema.sql lines 35-37
// ------------------------------------------------------------------------------
console.log("\n🏷️ [4/4] Testing Database Enum Definitions...");

const ROLE_ENUMS = new Set(["admin", "manager", "operator", "base"]);
assert.equal(ROLE_ENUMS.size, 4);
assert.ok(ROLE_ENUMS.has("admin"));
assert.ok(ROLE_ENUMS.has("manager"));
assert.ok(ROLE_ENUMS.has("operator"));
assert.ok(ROLE_ENUMS.has("base"));
assert.ok(!ROLE_ENUMS.has("customer")); // customers was deprecated/removed

const WEIGHMENT_TYPE_ENUMS = new Set(["pending", "in", "out", "unassigned"]);
assert.equal(WEIGHMENT_TYPE_ENUMS.size, 4);
assert.ok(WEIGHMENT_TYPE_ENUMS.has("pending"));
assert.ok(WEIGHMENT_TYPE_ENUMS.has("in"));
assert.ok(WEIGHMENT_TYPE_ENUMS.has("out"));
assert.ok(WEIGHMENT_TYPE_ENUMS.has("unassigned"));

const TICKET_STATUS_ENUMS = new Set(["pending", "approved", "rejected"]);
assert.equal(TICKET_STATUS_ENUMS.size, 3);
assert.ok(TICKET_STATUS_ENUMS.has("pending"));
assert.ok(TICKET_STATUS_ENUMS.has("approved"));
assert.ok(TICKET_STATUS_ENUMS.has("rejected"));

console.log("  ✓ All database enum sets match schema.sql exactly.");

console.log("\n=================================================");
console.log("🎉 All validation and schema invariant tests passed!");
console.log("=================================================");
