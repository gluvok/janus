/**
 * @file app/weighments/types.ts
 * @description Type definitions for Weighments domain model, dual-mode tables, and relations.
 */

import { z } from "zod";

export type WeighmentMode = "automatic" | "manual";
export type WeighmentType = "pending" | "in" | "out" | "unassigned";

export interface WeighmentCenter {
  id: number;
  name: string;
}

export interface WeighmentUser {
  id: number;
  name: string;
  username: string;
}

export interface Weighment {
  id: number;
  vehicle_number: string;
  in_detected_vehicle_number?: string | null;
  out_detected_vehicle_number?: string | null;
  in_weight: number;
  out_weight: number | null;
  in_time: string;
  out_time: string | null;
  in_center_id: number;
  out_center_id: number | null;
  in_center: WeighmentCenter;
  out_center: WeighmentCenter | null;
  in_creator_id?: number | null;
  out_creator_id?: number | null;
  in_creator?: WeighmentUser | null;
  out_creator?: WeighmentUser | null;
  images: string[];
  gross: number;
  tare: number | null;
  net: number | null;
  type: WeighmentType;
  created_at: string;
  updated_at: string;
}

export const ingestAutomaticWeighmentSchema = z.object({
  vehicle_number: z.string().trim().min(1, "Vehicle number is required"),
  weight: z.number().positive("Weight must be greater than 0"),
  center_id: z.number().int().positive("Center ID is required"),
  detected_vehicle_number: z.string().trim().optional(),
  images: z.array(z.string()).optional().default([]),
});

export type IngestAutomaticWeighmentInput = z.infer<typeof ingestAutomaticWeighmentSchema>;

export const createManualWeighmentSchema = z.object({
  vehicle_number: z.string().trim().min(1, "Vehicle number is required"),
  in_weight: z.number().positive("In weight must be greater than 0"),
  in_center_id: z.number().int().positive("In center ID is required"),
  in_creator_id: z.number().int().positive("In creator ID is required"),
  out_weight: z.number().positive("Out weight must be greater than 0").optional(),
  out_center_id: z.number().int().positive().optional(),
  out_creator_id: z.number().int().positive().optional(),
  images: z.array(z.string()).optional().default([]),
});

export type CreateManualWeighmentInput = z.infer<typeof createManualWeighmentSchema>;

export const updateWeighmentSchema = z.object({
  id: z.number().int().positive(),
  vehicle_number: z.string().trim().min(1).optional(),
  in_weight: z.number().positive().optional(),
  out_weight: z.number().positive().nullable().optional(),
  in_center_id: z.number().int().positive().optional(),
  out_center_id: z.number().int().positive().nullable().optional(),
  images: z.array(z.string()).optional(),
});

export type UpdateWeighmentInput = z.infer<typeof updateWeighmentSchema>;
