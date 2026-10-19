import { z } from "zod";
import { vehicleNumberSchema } from "./helpers";

/**
 * Authoritative schema for PATCH /api/entries/automatic payload.
 */
export const updateAutomaticEntrySchema = z
  .object({
    id: z.number().int().positive({ message: "Valid entry ID is required." }),
    vehicle_number: vehicleNumberSchema.optional(),
    customer_id: z.number().int().positive().nullable().optional(),
  })
  .refine((data) => data.vehicle_number !== undefined || data.customer_id !== undefined, {
    message: "At least one field (vehicle_number or customer_id) must be provided for update.",
  });

export type UpdateAutomaticEntryPayload = z.infer<typeof updateAutomaticEntrySchema>;

export function createAutomaticEntryFormSchema({
  canEditVehicle,
}: {
  canEditVehicle: boolean;
  canEditCustomer: boolean;
}) {
  return z.object({
    vehicle_number: canEditVehicle ? vehicleNumberSchema : z.string(),
    customer_id: z.string().optional(),
  });
}

export type AutomaticEntryFormData = {
  vehicle_number: string;
  customer_id?: string;
};
