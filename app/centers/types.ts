import { z } from "zod";

export const centerNameSchema = z
  .string()
  .trim()
  .min(1, "Center name is required")
  .max(100, "Center name must not exceed 100 characters");

export const centerSchema = z
  .object({
    id: z.number().int().positive(),
    name: centerNameSchema,
    factory_id: z.number().int().positive().optional(),
    api_key: z.string().min(1).optional(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

export const updateCenterSchema = z
  .object({
    id: z.number().int().positive(),
    name: centerNameSchema,
  })
  .strict();

export const centerFormSchema = z
  .object({
    name: centerNameSchema,
  })
  .strict();

export type Center = z.infer<typeof centerSchema>;
export type UpdateCenterInput = z.infer<typeof updateCenterSchema>;
export type CenterFormInput = z.infer<typeof centerFormSchema>;
