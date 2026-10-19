import { z } from "zod";

export const STATE_CODES = [
  "AN",
  "AP",
  "AR",
  "AS",
  "BR",
  "CH",
  "CG",
  "DD",
  "DL",
  "DN",
  "GA",
  "GJ",
  "HR",
  "HP",
  "JK",
  "JH",
  "KA",
  "KL",
  "LA",
  "LD",
  "MP",
  "MH",
  "MN",
  "ML",
  "MZ",
  "NL",
  "OD",
  "OR",
  "PB",
  "PY",
  "RJ",
  "SK",
  "TN",
  "TG",
  "TS",
  "TR",
  "UP",
  "UA",
  "UK",
  "WB",
] as const;

export type StateCode = (typeof STATE_CODES)[number];

export const INDIAN_PLATE_REGEX = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/i;

export function normalizeVehicleNumber(val: string): string {
  return val.replace(/[\s-]+/g, "").toUpperCase();
}

export function isValidIndianPlate(plate: string): boolean {
  const normalized = normalizeVehicleNumber(plate);
  const match = normalized.match(INDIAN_PLATE_REGEX);
  if (!match) return false;

  const state = match[1];
  return (STATE_CODES as readonly string[]).includes(state);
}

export const vehicleNumberSchema = z
  .string()
  .trim()
  .transform(normalizeVehicleNumber)
  .refine(isValidIndianPlate, {
    message: "Invalid Indian vehicle registration number format.",
  });
