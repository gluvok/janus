import { z } from "zod";

export const centerNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Center name is required" })
  .max(100, { error: "Center name must not exceed 100 characters" });

export const centerSchema = z
  .object({
    id: z.int().positive({ error: "Center ID must be a positive integer" }),
    name: centerNameSchema,
    factory_id: z.int().positive({ error: "Factory ID must be a positive integer" }).optional(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

export const updateCenterSchema = z
  .object({
    id: z.int().positive({ error: "Center ID must be a positive integer" }),
    name: centerNameSchema,
  })
  .strict();

export type Center = z.infer<typeof centerSchema>;
export type UpdateCenterInput = z.infer<typeof updateCenterSchema>;
