/**
 * @file scripts/test-seed/weighments.ts
 * @description Generates completed weighments pairing in_entries and out_entries strictly validating triggers.
 */

import { supabase } from "../supabase.ts";
import type { SeededEntry } from "./entries.ts";

export async function seedWeighments({
  pairedInEntries,
  pairedOutEntries,
}: {
  pairedInEntries: SeededEntry[];
  pairedOutEntries: SeededEntry[];
}): Promise<Array<{ id: number; in_entry_id: number; out_entry_id: number }>> {
  console.log("\n🚛 [5/6] Seeding Weighment Pairs (invoking trigger_weighments_auto_populate)...");

  if (pairedInEntries.length !== pairedOutEntries.length) {
    throw new Error(
      `Mismatched entry pairs: ${pairedInEntries.length} in-entries vs ${pairedOutEntries.length} out-entries`,
    );
  }

  const weighmentInserts = pairedInEntries.map((inEntry, i) => ({
    in_entry_id: inEntry.id,
    out_entry_id: pairedOutEntries[i].id,
  }));

  const { data: createdWeighments, error: weighmentErr } = await supabase
    .from("weighments")
    .insert(weighmentInserts)
    .select("id, in_entry_id, out_entry_id, gross, tare, net, type");

  if (weighmentErr || !createdWeighments) {
    throw new Error(`Failed to seed weighments: ${weighmentErr?.message}`);
  }

  console.log(
    `  ✓ Seeded ${createdWeighments.length} weighment cycles (gross, tare, net, type computed automatically).`,
  );

  return createdWeighments;
}
