import { z } from "zod";

export interface Customer {
  id: number;
  name: string;
  factory_id: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export const customerNameSchema = z
  .string()
  .trim()
  .min(1, "Customer name is required")
  .max(100, "Customer name must not exceed 100 characters");

export const createCustomerSchema = z.object({
  name: customerNameSchema,
  factory_id: z.number().int().positive().optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  id: z.number().int().positive(),
  name: customerNameSchema,
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const deleteCustomersSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "At least one customer ID is required"),
});
export type DeleteCustomersInput = z.infer<typeof deleteCustomersSchema>;
