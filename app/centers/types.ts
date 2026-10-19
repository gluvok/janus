import { z } from "zod";

export interface Center {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export const centerNameSchema = z
  .string()
  .trim()
  .min(1, "Center name is required")
  .max(100, "Center name must not exceed 100 characters");

export const updateCenterSchema = z.object({
  id: z.number().int().positive(),
  name: centerNameSchema,
});

export type UpdateCenterInput = z.infer<typeof updateCenterSchema>;
