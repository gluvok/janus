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
import { executeAutomaticWeighmentsQuery } from "@/lib/weighments-query";

const patchAutomaticWeighmentSchema = z.object({
  id: z.coerce.number().int().positive(),
  vehicle_number: vehicleNumberSchema.refine(
    (v) => v.length >= 8 && v.length <= 11,
    "Vehicle number must be 8 to 11 characters",
  ),
});

const deleteAutomaticWeighmentSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const GET = handleApiRoute(async (request: Request) => {
  return executeAutomaticWeighmentsQuery(request);
});

export const PATCH = handleApiRoute(async (request: Request, context: ApiContext) => {
  const body: unknown = await request.json().catch(() => ({}));
  const validation = patchAutomaticWeighmentSchema.safeParse(body);

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
      throw new ServiceError(error.message, StatusCodes.NOT_FOUND);
    }
    if (error.message.includes("already been updated")) {
      throw new ServiceError(error.message, StatusCodes.CONFLICT);
    }
    throw new ServiceError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  return NextResponse.json({
    data,
    message: "Vehicle number updated successfully.",
  });
});

export const DELETE = handleApiRoute(async (request: Request, context: ApiContext) => {
  if (context.user.role !== "admin") {
    throw new ServiceError("Forbidden", StatusCodes.FORBIDDEN);
  }

  const { searchParams } = new URL(request.url);
  const queryId = searchParams.get("id");
  const rawInput: unknown =
    queryId !== null ? { id: queryId } : await request.json().catch(() => ({}));

  const validation = deleteAutomaticWeighmentSchema.safeParse(rawInput);

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
      throw new ServiceError(error.message, StatusCodes.NOT_FOUND);
    }
    throw new ServiceError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  return NextResponse.json({
    success: true,
    message: "Weighment deleted successfully.",
  });
});
