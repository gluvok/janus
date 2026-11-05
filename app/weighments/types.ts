/**
 * @file app/weighments/types.ts
 * @description Type definitions for Weighments domain model, dual-mode tables, and relations.
 */

import { z } from "zod";

export const WEIGHMENT_MODES = ["automatic", "manual"] as const;
export type WeighmentMode = (typeof WEIGHMENT_MODES)[number];

export const WEIGHMENT_TYPES = ["pending", "in", "out", "unassigned"] as const;
export type WeighmentType = (typeof WEIGHMENT_TYPES)[number];
export const weighmentTypeEnum = z.enum(WEIGHMENT_TYPES);

export const weighmentCenterSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().min(1),
  })
  .strict();
export type WeighmentCenter = z.infer<typeof weighmentCenterSchema>;

export const weighmentUserSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    username: z.string().min(1),
  })
  .strict();
export type WeighmentUser = z.infer<typeof weighmentUserSchema>;

export const weighmentSchema = z
  .object({
    id: z.number().int().positive(),
    vehicle_number: z.string().min(1),
    in_detected_vehicle_number: z.string().nullable().optional(),
    out_detected_vehicle_number: z.string().nullable().optional(),
    in_weight: z.number().positive(),
    out_weight: z.number().positive().nullable(),
    in_time: z.string(),
    out_time: z.string().nullable(),
    in_center_id: z.number().int().positive(),
    out_center_id: z.number().int().positive().nullable(),
    in_center: weighmentCenterSchema,
    out_center: weighmentCenterSchema.nullable(),
    in_creator_id: z.number().int().positive().nullable().optional(),
    out_creator_id: z.number().int().positive().nullable().optional(),
    in_creator: weighmentUserSchema.nullable().optional(),
    out_creator: weighmentUserSchema.nullable().optional(),
    images: z.array(z.string()),
    gross: z.number(),
    tare: z.number().nullable(),
    net: z.number().nullable(),
    type: weighmentTypeEnum,
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

export type Weighment = z.infer<typeof weighmentSchema>;

export const ingestAutomaticWeighmentSchema = z
  .object({
    vehicle_number: z.string().trim().min(1, "Vehicle number is required"),
    weight: z.number().positive("Weight must be greater than 0"),
    center_id: z.number().int().positive("Center ID is required"),
    detected_vehicle_number: z.string().trim().optional(),
    images: z.array(z.string()).optional().default([]),
  })
  .strict();

export type IngestAutomaticWeighmentInput = z.infer<typeof ingestAutomaticWeighmentSchema>;

export const updateWeighmentSchema = z
  .object({
    id: z.number().int().positive(),
    vehicle_number: z.string().trim().min(1).optional(),
    in_weight: z.number().positive().optional(),
    out_weight: z.number().positive().nullable().optional(),
    in_center_id: z.number().int().positive().optional(),
    out_center_id: z.number().int().positive().nullable().optional(),
    images: z.array(z.string()).optional(),
  })
  .strict();

export type UpdateWeighmentInput = z.infer<typeof updateWeighmentSchema>;
