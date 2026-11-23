/**
 * @file scripts/test-seed/constants.ts
 * @description Invariant database table clear order and sample vehicle registrations.
 */

export const TABLES_IN_CLEAR_ORDER = [
  "tickets",
  "weighments",
  "entries",
  "sessions",
  "centers",
  "users",
  "factories",
] as const;

export const SAMPLE_PLATES = [
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
] as const;

export function daysAgo(days: number, minutesOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setMinutes(d.getMinutes() - minutesOffset);
  return d.toISOString();
}
