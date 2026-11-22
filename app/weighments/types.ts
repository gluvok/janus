/**
 * @file app/weighments/types.ts
 * @description Type definitions for Weighments domain model, dual-mode tables, and relations.
 */

import { z } from "zod";
import { userRoleEnum } from "@/app/users/types";

export const WEIGHMENT_MODES = ["automatic", "manual"] as const;
export type WeighmentMode = (typeof WEIGHMENT_MODES)[number];

/* -------------------------------------------------------------------------- */
/* Weighment Types (Separated 1:1 with PostgreSQL ENUMs)                      */
/* -------------------------------------------------------------------------- */

export const COMPLETE_WEIGHMENT_TYPES = ["in", "out", "unassigned"] as const;
export type CompleteWeighmentType = (typeof COMPLETE_WEIGHMENT_TYPES)[number];
export const completeWeighmentTypeSchema = z.enum(COMPLETE_WEIGHMENT_TYPES);

export const AUTOMATIC_WEIGHMENT_TYPES = ["pending", ...COMPLETE_WEIGHMENT_TYPES] as const;
export type AutomaticWeighmentType = (typeof AUTOMATIC_WEIGHMENT_TYPES)[number];
export const automaticWeighmentTypeSchema = z.enum(AUTOMATIC_WEIGHMENT_TYPES);

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
    role: userRoleEnum,
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
    idempotency_key: z.uuidv7(),
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
    type: completeWeighmentTypeSchema,
  })
  .strict();
export type ManualWeighment = z.infer<typeof manualWeighmentSchema>;

/**
 * CompletedAutomaticWeighment: Strict non-null schema required for completed automatic weighment receipt slips.
 */
export const completedAutomaticWeighmentSchema = automaticWeighmentSchema.extend({
  out_weight: z.number().positive(),
  out_time: z.string(),
  out_center_id: z.int().positive(),
  out_center: weighmentCenterSchema,
  tare: z.number().positive(),
  net: z.number().nonnegative(),
  type: completeWeighmentTypeSchema,
});

export type CompletedAutomaticWeighment = z.infer<typeof completedAutomaticWeighmentSchema>;
