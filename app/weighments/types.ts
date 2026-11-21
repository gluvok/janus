/**
 * @file app/weighments/types.ts
 * @description Type definitions for Weighments domain model, dual-mode tables, and relations.
 */

import { z } from "zod";

export const WEIGHMENT_MODES = ["automatic", "manual"] as const;
export type WeighmentMode = (typeof WEIGHMENT_MODES)[number];

/* -------------------------------------------------------------------------- */
/* Weighment Types (Separated 1:1 with PostgreSQL ENUMs)                      */
/* -------------------------------------------------------------------------- */

export const AUTOMATIC_WEIGHMENT_TYPES = ["pending", "in", "out", "unassigned"] as const;
export type AutomaticWeighmentType = (typeof AUTOMATIC_WEIGHMENT_TYPES)[number];
export const automaticWeighmentTypeSchema = z.enum(AUTOMATIC_WEIGHMENT_TYPES);

export const MANUAL_WEIGHMENT_TYPES = ["in", "out", "unassigned"] as const;
export type ManualWeighmentType = (typeof MANUAL_WEIGHMENT_TYPES)[number];
export const manualWeighmentTypeSchema = z.enum(MANUAL_WEIGHMENT_TYPES);

// Unified union type for multi-mode table views
export const WEIGHMENT_TYPES = AUTOMATIC_WEIGHMENT_TYPES;
export type WeighmentType = AutomaticWeighmentType;
export const weighmentTypeEnum = automaticWeighmentTypeSchema;

// Completed weighments strictly use manual weighment types ('in', 'out', 'unassigned')
export const COMPLETED_WEIGHMENT_TYPES = MANUAL_WEIGHMENT_TYPES;
export type CompletedWeighmentType = ManualWeighmentType;
export const completedWeighmentTypeEnum = manualWeighmentTypeSchema;

export const weighmentCenterSchema = z
  .object({
    id: z.int().positive(),
    name: z.string().min(1),
    factory_id: z.int().positive().optional(),
  })
  .strict();
export type WeighmentCenter = z.infer<typeof weighmentCenterSchema>;

export const weighmentUserSchema = z
  .object({
    id: z.int().positive(),
    name: z.string().min(1),
    username: z.string().min(1),
  })
  .strict();
export type WeighmentUser = z.infer<typeof weighmentUserSchema>;

/* -------------------------------------------------------------------------- */
/* Domain Entities (Mirrors schema.sql 1:1)                                    */
/* -------------------------------------------------------------------------- */

const baseWeighmentFields = {
  id: z.int().positive(),
  vehicle_number: z.string().min(1),
  in_weight: z.number().positive(),
  in_time: z.string(),
  in_center_id: z.int().positive(),
  in_center: weighmentCenterSchema,
  in_images: z.array(z.string()),
  out_images: z.array(z.string()),
  images: z.array(z.string()),
  gross: z.number().positive(),
  created_at: z.string(),
  updated_at: z.string(),
};

/**
 * automatic_weighments: Can be pending (out_weight/out_time/out_center nullable),
 * has camera detected plates and non-null hardware idempotency_key, NO creator.
 */
export const automaticWeighmentSchema = z
  .object({
    ...baseWeighmentFields,
    idempotency_key: z.string().min(1),
    in_detected_vehicle_number: z.string().nullable().optional(),
    out_detected_vehicle_number: z.string().nullable().optional(),
    out_weight: z.number().positive().nullable(),
    out_time: z.string().nullable(),
    out_center_id: z.int().positive().nullable(),
    out_center: weighmentCenterSchema.nullable(),
    tare: z.number().positive().nullable(),
    net: z.number().nonnegative().nullable(),
    type: automaticWeighmentTypeSchema,
  })
  .strict();
export type AutomaticWeighment = z.infer<typeof automaticWeighmentSchema>;

/**
 * manual_weighments: Always full/closed (all out fields NOT NULL),
 * has single creator (operator), NO detected plates or idempotency_key.
 */
export const manualWeighmentSchema = z
  .object({
    ...baseWeighmentFields,
    out_weight: z.number().positive(),
    out_time: z.string(),
    out_center_id: z.int().positive(),
    out_center: weighmentCenterSchema,
    creator_id: z.int().positive(),
    creator: weighmentUserSchema,
    tare: z.number().positive(),
    net: z.number().nonnegative(),
    type: manualWeighmentTypeSchema,
  })
  .strict();
export type ManualWeighment = z.infer<typeof manualWeighmentSchema>;

/**
 * Unified Weighment schema used in TanStack table views covering both automatic & manual modes.
 */
export const weighmentSchema = z
  .object({
    ...baseWeighmentFields,
    idempotency_key: z.string().min(1).optional(),
    in_detected_vehicle_number: z.string().nullable().optional(),
    out_detected_vehicle_number: z.string().nullable().optional(),
    out_weight: z.number().positive().nullable(),
    out_time: z.string().nullable(),
    out_center_id: z.int().positive().nullable(),
    out_center: weighmentCenterSchema.nullable(),
    creator_id: z.int().positive().nullable().optional(),
    creator: weighmentUserSchema.nullable().optional(),
    tare: z.number().positive().nullable(),
    net: z.number().nonnegative().nullable(),
    type: automaticWeighmentTypeSchema,
  })
  .strict();

export type Weighment = z.infer<typeof weighmentSchema>;

/**
 * CompletedWeighment: Strict non-null schema required for official weighment receipt slips.
 */
export const completedWeighmentSchema = weighmentSchema.extend({
  out_weight: z.number().positive(),
  out_time: z.string(),
  out_center_id: z.int().positive(),
  out_center: weighmentCenterSchema,
  tare: z.number().positive(),
  net: z.number().nonnegative(),
  type: manualWeighmentTypeSchema,
});

export type CompletedWeighment = z.infer<typeof completedWeighmentSchema>;
