/**
 * @file lib/validation/entries.ts
 * @description Zod schema and validation rules for Entries entities.
 */

import * as z from "zod";
import { EntryStatus, EntrySource } from "@/lib/constants/enums";
import {
  integerIdSchema,
  optionalIntegerIdSchema,
  indianPlateSchema,
  optionalIndianPlateSchema,
  positiveWeightSchema,
  optionalPositiveWeightSchema,
  isNoPlateDetectedText,
} from "./helpers";

export const entryStatusSchema = z
  .enum([EntryStatus.PENDING, EntryStatus.APPROVED, EntryStatus.REJECTED])
  .default(EntryStatus.PENDING);

export const deviceVehicleNumberSchema = (fieldName = "Vehicle Number") =>
  z.preprocess(
    (val) => (isNoPlateDetectedText(val) ? "NO_PLATE_DETECTED" : val),
    z.union([z.literal("NO_PLATE_DETECTED"), indianPlateSchema(fieldName)]),
  );

const idempotencyKeySchema = z.uuid("Idempotency-Key must be a UUID").optional();

/**
 * Common schema fields shared across addEntrySchema and addDeviceEntrySchema.
 */
export const baseEntrySchema = z.object({
  weight: positiveWeightSchema("Weight"),
  center_id: integerIdSchema("Center"),
});

export const addEntrySchema = baseEntrySchema.extend({
  vehicle_number: indianPlateSchema("Vehicle Number"),
  source: z.enum([EntrySource.MANUAL, EntrySource.DEVICE]).optional(),
  created_by: optionalIntegerIdSchema("Created By").default(null),
  user_id: optionalIntegerIdSchema("User").default(null),
  customer_id: optionalIntegerIdSchema("Customer").default(null),
  status: entryStatusSchema,
  images: z.array(z.string()).optional(),
  idempotency_key: idempotencyKeySchema,
});

export const addDeviceEntrySchema = z.object({
  weight: positiveWeightSchema("Weight"),
  center_id: integerIdSchema("Center"),
  detected_vehicle_number: deviceVehicleNumberSchema("Detected vehicle number"),
  images: z.array(z.string()).optional().default([]),
  idempotency_key: idempotencyKeySchema,
});

export const editEntrySchema = z.object({
  vehicle_number: optionalIndianPlateSchema("Vehicle Number"),
  weight: optionalPositiveWeightSchema("Weight"),
  center_id: optionalIntegerIdSchema("Center"),
  customer_id: optionalIntegerIdSchema("Customer"),
  status: z.enum([EntryStatus.PENDING, EntryStatus.APPROVED, EntryStatus.REJECTED]).optional(),
  images: z.array(z.string()).optional(),
  update_weighment_pair: z.boolean().optional(),
});

export type AddEntryInput = z.infer<typeof addEntrySchema>;
export type AddDeviceEntryInput = z.infer<typeof addDeviceEntrySchema>;
export type EditEntryInput = z.infer<typeof editEntrySchema>;
