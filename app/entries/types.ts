import { z } from "zod";
import { userRoleEnum } from "@/app/users/types";

const baseEntryFields = {
  id: z.int().positive(),
  factory_id: z.int().positive(),
  center_id: z.int().positive(),
  center_name: z.string().min(1),
  vehicle_number: z.string().min(1),
  weight: z.number().positive(),
  images: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable().optional(),
};

export const automaticEntrySchema = z
  .object({
    ...baseEntryFields,
  })
  .strict();

export type AutomaticEntry = z.infer<typeof automaticEntrySchema>;

export const AUTOMATIC_ENTRY_SELECT_PROJECTION = `
  id,
  factory_id,
  center_id,
  center_name,
  vehicle_number,
  weight,
  images,
  created_at,
  updated_at,
  deleted_at
` as const;

export const manualEntrySchema = z
  .object({
    ...baseEntryFields,
    creator_id: z.int().positive(),
    creator_name: z.string().min(1),
    creator_username: z.string().min(1),
    creator_role: userRoleEnum,
  })
  .strict();

export type ManualEntry = z.infer<typeof manualEntrySchema>;

export const MANUAL_ENTRY_SELECT_PROJECTION = `
  id,
  factory_id,
  center_id,
  center_name,
  creator_id,
  creator_name,
  creator_username,
  creator_role,
  vehicle_number,
  weight,
  images,
  created_at,
  updated_at,
  deleted_at
` as const;
