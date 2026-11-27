import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import {
  handleApiRoute,
  ServiceError,
  validationErrorResponse,
  type ApiContext,
} from "@/lib/api-handler";
import { supabase } from "@/lib/supabase";
import { vehicleNumberSchema } from "@/lib/validation/helpers";
import { ADMIN } from "@/lib/security";

const weighmentIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const patchAutomaticWeighmentSchema = weighmentIdSchema.extend({
  vehicle_number: vehicleNumberSchema.refine(
    (v) => v.length >= 8 && v.length <= 11,
    "Vehicle number must be 8 to 11 characters",
  ),
});

export const PATCH = handleApiRoute(
  async (request: Request, context: ApiContext) => {
    const body: unknown = await request.json().catch(() => ({}));
    // The path id goes last so a body-supplied `id` can never override it.
    const validation = patchAutomaticWeighmentSchema.safeParse(
      Object.assign({}, body, { id: context.params.id }),
    );

    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { id, vehicle_number } = validation.data;
    const { data, error } = await supabase.rpc("correct_automatic_weighment_plate", {
      p_weighment_id: id,
      p_factory_id: context.factory.id,
      p_vehicle_number: vehicle_number,
    });

    if (error) {
      if (error.message.includes("Weighment not found")) {
        throw new ServiceError("Weighment not found.", StatusCodes.NOT_FOUND);
      }
      console.error("correct_automatic_weighment_plate failed:", error);
      throw new ServiceError("Failed to update vehicle number.", StatusCodes.INTERNAL_SERVER_ERROR);
    }

    return NextResponse.json({
      data,
      message: "Vehicle number updated successfully.",
    });
  },
  { roles: ADMIN },
);

export const DELETE = handleApiRoute(
  async (_request: Request, context: ApiContext) => {
    const validation = weighmentIdSchema.safeParse({ id: context.params.id });

    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { id } = validation.data;
    const { error } = await supabase.rpc("soft_delete_automatic_weighment", {
      p_weighment_id: id,
      p_factory_id: context.factory.id,
    });

    if (error) {
      if (error.message.includes("Weighment not found")) {
        throw new ServiceError("Weighment not found.", StatusCodes.NOT_FOUND);
      }
      console.error("soft_delete_automatic_weighment failed:", error);
      throw new ServiceError("Failed to delete weighment.", StatusCodes.INTERNAL_SERVER_ERROR);
    }

    return NextResponse.json({
      success: true,
      message: "Weighment deleted successfully.",
    });
  },
  { roles: ADMIN },
);
