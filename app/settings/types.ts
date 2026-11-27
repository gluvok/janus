import { z } from "zod";

export const factorySchema = z
  .object({
    id: z.int().positive({ error: "Factory ID must be a positive integer" }),
    name: z.string().min(1, { error: "Factory name cannot be empty" }),
    receipt_images_per_row: z
      .int()
      .min(1, { error: "Must be at least 1" })
      .max(2, { error: "Cannot exceed 2" }),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

export const updateFactorySchema = z
  .object({
    name: z.string().trim().min(1, { error: "Factory name must be a non-empty string" }).optional(),
    receipt_images_per_row: z
      .int({ error: "Must be an integer" })
      .min(1, { error: "Must be at least 1" })
      .max(2, { error: "Cannot exceed 2" })
      .optional(),
  })
  .strict()
  .refine((data) => data.name !== undefined || data.receipt_images_per_row !== undefined, {
    error: "At least one field must be provided to update",
  });

export const factoryFormSchema = z
  .object({
    name: z.string().trim().min(1, { error: "Factory name cannot be empty" }),
    receipt_images_per_row: z
      .int({ error: "Must be an integer" })
      .min(1, { error: "Must be at least 1" })
      .max(2, { error: "Cannot exceed 2" }),
  })
  .strict();

export type Factory = z.infer<typeof factorySchema>;
export type FactoryFormInput = z.infer<typeof factoryFormSchema>;

export interface FactoryApiResponse {
  data: Factory;
  error?: string;
}
