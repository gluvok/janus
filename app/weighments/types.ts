/**
 * @file app/weighments/types.ts
 * @description Type definitions for Automatic and Manual Weighments domain models matching schema.sql views.
 */

import { z } from "zod";
import { userRoleEnum } from "@/app/users/types";

export const WEIGHMENT_TYPES = ["in", "out", "void"] as const;
export type WeighmentType = (typeof WEIGHMENT_TYPES)[number];
export const weighmentTypeSchema = z.enum(WEIGHMENT_TYPES);

export const automaticWeighmentSchema = z
  .object({
    id: z.int().positive(),
    factory_id: z.int().positive(),
    in_entry_id: z.int().positive(),
    out_entry_id: z.int().positive(),
    vehicle_number: z.string().min(1),
    gross: z.number().positive(),
    tare: z.number().nonnegative(),
    net: z.number(),
    type: weighmentTypeSchema,
    in_time: z.string(),
    out_time: z.string(),
    in_center_id: z.int().positive(),
    in_center_name: z.string().min(1),
    out_center_id: z.int().positive(),
    out_center_name: z.string().min(1),
    in_images: z.array(z.string()),
    out_images: z.array(z.string()),
    images: z.array(z.string()),
    created_at: z.string(),
    updated_at: z.string(),
    deleted_at: z.string().nullable().optional(),
  })
  .strict();

export type AutomaticWeighment = z.infer<typeof automaticWeighmentSchema>;

export const AUTOMATIC_WEIGHMENT_SELECT_PROJECTION = `
  id,
  factory_id,
  in_entry_id,
  out_entry_id,
  vehicle_number,
  gross,
  tare,
  net,
  type,
  in_time,
  out_time,
  in_center_id,
  in_center_name,
  out_center_id,
  out_center_name,
  in_images,
  out_images,
  images,
  created_at,
  updated_at,
  deleted_at
` as const;

export const manualWeighmentSchema = automaticWeighmentSchema
  .extend({
    in_creator_id: z.int().positive(),
    in_creator_name: z.string().min(1),
    in_creator_username: z.string().min(1),
    in_creator_role: userRoleEnum,
    out_creator_id: z.int().positive(),
    out_creator_name: z.string().min(1),
    out_creator_username: z.string().min(1),
    out_creator_role: userRoleEnum,
  })
  .strict();

export type ManualWeighment = z.infer<typeof manualWeighmentSchema>;

export const MANUAL_WEIGHMENT_SELECT_PROJECTION = `
  id,
  factory_id,
  in_entry_id,
  out_entry_id,
  vehicle_number,
  gross,
  tare,
  net,
  type,
  in_time,
  out_time,
  in_center_id,
  in_center_name,
  out_center_id,
  out_center_name,
  in_creator_id,
  in_creator_name,
  in_creator_username,
  in_creator_role,
  out_creator_id,
  out_creator_name,
  out_creator_username,
  out_creator_role,
  in_images,
  out_images,
  images,
  created_at,
  updated_at,
  deleted_at
` as const;

export type AnyWeighment = AutomaticWeighment | ManualWeighment;
export type Weighment = AnyWeighment;
