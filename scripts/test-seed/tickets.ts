/**
 * @file scripts/test-seed/tickets.ts
 * @description Provisions support tickets covering all 3 ticket_status variants.
 */

import { supabase } from "../supabase.ts";
import type { SeedContext } from "./types.ts";

export async function seedTickets({
  ctx,
  createdAuto,
}: {
  ctx: SeedContext;
  createdAuto: Array<{
    id: number;
    vehicle_number: string;
    in_detected_vehicle_number: string | null;
  }>;
}): Promise<void> {
  console.log("\n🎫 [5/5] Seeding Support Tickets across all ticket_status variants...");

  const operatorId1 = ctx.userMap.get("operator1")!;
  const operatorId2 = ctx.userMap.get("operator2")!;
  const operatorApexId = ctx.userMap.get("operatorApex1")!;

  const ocrMismatchWeighment =
    createdAuto.find(
      (w) => w.in_detected_vehicle_number && w.in_detected_vehicle_number !== w.vehicle_number,
    ) ?? createdAuto[4];

  const ticketConfigs = [
    {
      concern: `Camera OCR misread plate as '${ocrMismatchWeighment.in_detected_vehicle_number}' on inbound scale.`,
      reply: `Plate verified manually as '${ocrMismatchWeighment.vehicle_number}' by gate operator.`,
      status: "approved" as const,
      automatic_weighment_id: ocrMismatchWeighment.id,
      user_id: operatorId1,
    },
    {
      concern: "Gross weight fluctuation detected during high wind conditions on platform.",
      reply: "Axle load re-weighed on auxiliary platform.",
      status: "approved" as const,
      automatic_weighment_id: createdAuto[1].id,
      user_id: operatorId2,
    },
    {
      concern: "Unmatched outbound weighment query awaiting driver delivery invoice.",
      reply: null,
      status: "pending" as const,
      automatic_weighment_id: createdAuto[0].id,
      user_id: operatorId1,
    },
    {
      concern: "Request to void completed weighment ticket due to incorrect driver tare claim.",
      reply: "Rejected. Delivery invoice has already been issued and recorded in ERP.",
      status: "rejected" as const,
      automatic_weighment_id: createdAuto[30].id,
      user_id: operatorApexId,
    },
  ];

  const { data: createdTickets, error: ticketErr } = await supabase
    .from("tickets")
    .insert(ticketConfigs)
    .select("id");

  if (ticketErr || !createdTickets) throw ticketErr;
  console.log(`  ✓ Seeded ${createdTickets.length} tickets (approved, pending, rejected).`);
}
