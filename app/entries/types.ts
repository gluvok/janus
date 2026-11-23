/**
 * @file app/entries/types.ts
 * @description Type definitions and zod schemas for the Entries domain model matching entries_view.
 */

import { z } from "zod";

export const entrySchema = z
  .object({
    id: z.int().positive(),
    factory_id: z.int().positive(),
    center_id: z.int().positive(),
    center_name: z.string().min(1),
    creator_id: z.int().positive().nullable(),
    creator_name: z.string().nullable().optional(),
    creator_username: z.string().nullable().optional(),
    vehicle_number: z.string().min(1),
    weight: z.number().positive(),
    images: z.array(z.string()),
    idempotency_key: z.string().min(1),
    created_at: z.string(),
    updated_at: z.string(),
    deleted_at: z.string().nullable().optional(),
  })
  .strict();

export type Entry = z.infer<typeof entrySchema>;

export const ENTRY_SELECT_PROJECTION = `
  id,
  factory_id,
  center_id,
  center_name,
  creator_id,
  creator_name,
  creator_username,
  vehicle_number,
  weight,
  images,
  idempotency_key,
  created_at,
  updated_at,
  deleted_at
` as const;
