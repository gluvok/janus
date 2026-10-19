import assert from "node:assert/strict";
import {
  isValidIndianPlate,
  normalizeVehicleNumber,
  vehicleNumberSchema,
} from "../lib/validation/helpers.ts";

// 1. Test normalization
assert.equal(normalizeVehicleNumber("mh 12 ab 1028"), "MH12AB1028");
assert.equal(normalizeVehicleNumber("  gj-03  ab  1234 "), "GJ03AB1234");
assert.equal(normalizeVehicleNumber("MH-12-AB-1028"), "MH12AB1028");

// 2. Test valid commercial formats
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

// 3. Test invalid formats (including non-commercial BH and VA)
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

console.log("All validation tests passed successfully!");
