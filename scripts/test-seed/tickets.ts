/**
 * @file scripts/test-seed/tickets.ts
 * @description Provisions support tickets linked to entries covering all 3 ticket_status variants.
 */

import { supabase } from "../supabase.ts";
import type { SeededEntry } from "./entries.ts";

export async function seedTickets({
  pairedInEntries,
  standaloneEntries,
}: {
  pairedInEntries: SeededEntry[];
  standaloneEntries: SeededEntry[];
}): Promise<void> {
  console.log("\n🎫 [6/6] Seeding Support Tickets across all ticket_status variants...");

  const allAvailableEntries = [...pairedInEntries, ...standaloneEntries];
  if (allAvailableEntries.length < 4) {
    throw new Error("Insufficient entries to attach support tickets.");
  }

  const ticketConfigs = [
    {
      concern: `Camera OCR misread plate on scale entry #${allAvailableEntries[0].id}. Vehicle verified manually.`,
      reply: "Plate verified against gate log and updated in operational record.",
      status: "approved" as const,
      entry_id: allAvailableEntries[0].id,
    },
    {
      concern: `Gross weight fluctuation detected during high wind conditions for entry #${allAvailableEntries[1].id}.`,
      reply: "Axle load re-weighed and calibrated on auxiliary platform.",
      status: "approved" as const,
      entry_id: allAvailableEntries[1].id,
    },
    {
      concern: `Unmatched outbound entry #${allAvailableEntries[2].id} awaiting driver delivery manifest.`,
      reply: null,
      status: "pending" as const,
      entry_id: allAvailableEntries[2].id,
    },
    {
      concern: `Driver contested scale reading #${allAvailableEntries[3].id} citing moisture in trailer.`,
      reply: "Rejected. Moisture allowance already deducted per standard receiving procedure.",
      status: "rejected" as const,
      entry_id: allAvailableEntries[3].id,
    },
  ];

  const { data: createdTickets, error: ticketErr } = await supabase
    .from("tickets")
    .insert(ticketConfigs)
    .select("id, status, entry_id");

  if (ticketErr || !createdTickets) {
    throw new Error(`Failed to seed tickets: ${ticketErr?.message}`);
  }

  console.log(`  ✓ Seeded ${createdTickets.length} tickets (approved, pending, rejected).`);
}
