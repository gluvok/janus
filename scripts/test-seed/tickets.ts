/**
 * @file scripts/test-seed/tickets.ts
 * @description Provisions automatic and manual support tickets linked to entries covering all 3 ticket_status variants.
 */

import { supabase } from "../supabase.ts";
import type { EntryGroup, SeededAutomaticEntry, SeededManualEntry } from "./entries.ts";
import type { SeedContext } from "./types.ts";

interface TicketSpec {
  concern: string;
  reply: string | null;
  status: "pending" | "approved" | "rejected";
  entry_id: number;
  creator_id: number;
}

function buildTicketSpecs(
  entries: Array<{ id: number }>,
  creatorIds: [number, number, number, number],
  label: "automatic" | "manual",
): TicketSpec[] {
  if (entries.length < 4) {
    throw new Error(`Insufficient ${label} entries to attach support tickets.`);
  }

  return [
    {
      concern: `Camera OCR misread plate on ${label} entry #${entries[0].id}. Vehicle verified manually.`,
      reply: "Plate verified against gate log and updated in operational record.",
      status: "approved",
      entry_id: entries[0].id,
      creator_id: creatorIds[0],
    },
    {
      concern: `Gross weight fluctuation detected during high wind conditions for ${label} entry #${entries[1].id}.`,
      reply: "Axle load re-weighed and calibrated on auxiliary platform.",
      status: "approved",
      entry_id: entries[1].id,
      creator_id: creatorIds[1],
    },
    {
      concern: `Unmatched outbound ${label} entry #${entries[2].id} awaiting driver delivery manifest.`,
      reply: null,
      status: "pending",
      entry_id: entries[2].id,
      creator_id: creatorIds[2],
    },
    {
      concern: `Driver contested ${label} scale reading #${entries[3].id} citing moisture in trailer.`,
      reply: "Rejected. Moisture allowance already deducted per standard receiving procedure.",
      status: "rejected",
      entry_id: entries[3].id,
      creator_id: creatorIds[3],
    },
  ];
}

export async function seedTickets({
  ctx,
  automatic,
  manual,
}: {
  ctx: SeedContext;
  automatic: EntryGroup<SeededAutomaticEntry>;
  manual: EntryGroup<SeededManualEntry>;
}): Promise<void> {
  console.log(
    "\n🎫 [6/6] Seeding Automatic & Manual Support Tickets across all ticket_status variants...",
  );

  const operator1Id = ctx.userMap.get("operator1");
  const operator2Id = ctx.userMap.get("operator2");
  const manager1Id = ctx.userMap.get("manager1");

  if (!operator1Id || !operator2Id || !manager1Id) {
    throw new Error("Missing required Factory 1 users in userMap for seeding tickets.");
  }

  const creatorTuple: [number, number, number, number] = [
    operator1Id,
    operator2Id,
    manager1Id,
    operator1Id,
  ];

  const autoTicketSpecs = buildTicketSpecs(
    [...automatic.pairedInEntries, ...automatic.standaloneEntries],
    creatorTuple,
    "automatic",
  );
  const manualTicketSpecs = buildTicketSpecs(
    [...manual.pairedInEntries, ...manual.standaloneEntries],
    creatorTuple,
    "manual",
  );

  const [autoRes, manualRes] = await Promise.all([
    supabase
      .from("automatic_tickets")
      .insert(autoTicketSpecs)
      .select("id, status, entry_id, creator_id"),
    supabase
      .from("manual_tickets")
      .insert(manualTicketSpecs)
      .select("id, status, entry_id, creator_id"),
  ]);

  if (autoRes.error || !autoRes.data) {
    throw new Error(`Failed to seed automatic_tickets: ${autoRes.error?.message}`);
  }
  if (manualRes.error || !manualRes.data) {
    throw new Error(`Failed to seed manual_tickets: ${manualRes.error?.message}`);
  }

  console.log(
    `  ✓ Seeded ${autoRes.data.length} automatic_tickets and ${manualRes.data.length} manual_tickets (approved, pending, rejected).`,
  );
}
