import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { generateApiKey, hashApiKey } from "@/lib/api-key";
import { handleApiRoute, ServiceError, type ApiContext } from "@/lib/api-handler";
import { ADMIN } from "@/lib/security";

const rotateSchema = z.object({ id: z.int().positive() }).strict();

export const POST = handleApiRoute(
  async (request: Request, context: ApiContext) => {
    // Malformed JSON would otherwise reach handleApiRoute's catch-all as a 500.
    const validation = rotateSchema.safeParse(await request.json().catch(() => null));
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const apiKey = generateApiKey();
    // updated_at is set by trg_centers_timestamp.
    const { data, error } = await supabase
      .from("centers")
      .update({ api_key_hash: hashApiKey(apiKey) })
      .eq("id", validation.data.id)
      .eq("factory_id", context.factory.id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Center key rotation failed:", error);
      throw new ServiceError("Failed to rotate key.", StatusCodes.INTERNAL_SERVER_ERROR);
    }
    if (!data) {
      return NextResponse.json({ error: "Center not found." }, { status: StatusCodes.NOT_FOUND });
    }

    // Shown once: only the hash is stored. The old key stops working immediately.
    return NextResponse.json(
      { data: { id: data.id, api_key: apiKey } },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
  { roles: ADMIN },
);
