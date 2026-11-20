import { z } from "zod";

export const factorySchema = z
  .object({
    id: z.number().int(),
    name: z.string().min(1, "Factory name cannot be empty"),
    receipt_images_per_row: z.number().int().min(1).max(2),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

export const updateFactorySchema = z
  .object({
    name: z.string().trim().min(1, "Factory name must be a non-empty string").optional(),
    receipt_images_per_row: z
      .number()
      .int("Must be an integer")
      .min(1, "Must be at least 1")
      .max(2, "Cannot exceed 2")
      .optional(),
  })
  .strict()
  .refine((data) => data.name !== undefined || data.receipt_images_per_row !== undefined, {
    message: "At least one field must be provided to update",
  });

export const factoryFormSchema = z
  .object({
    name: z.string().trim().min(1, "Factory name cannot be empty"),
    receipt_images_per_row: z
      .number()
      .int("Must be an integer")
      .min(1, "Must be at least 1")
      .max(2, "Cannot exceed 2"),
  })
  .strict();

export type Factory = z.infer<typeof factorySchema>;
export type UpdateFactoryInput = z.infer<typeof updateFactorySchema>;
export type FactoryFormInput = z.infer<typeof factoryFormSchema>;

export interface FactoryApiResponse {
  data: Factory;
  error?: string;
}
