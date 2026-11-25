/**
 * @file scripts/test-seed/weighments.ts
 * @description Generates completed automatic and manual weighments pairing in/out entries and invoking triggers.
 */

import { supabase } from "../supabase.ts";
import type { EntryGroup, SeededAutomaticEntry, SeededManualEntry } from "./entries.ts";

export interface SeededWeighmentRow {
  id: number;
  in_entry_id: number;
  out_entry_id: number;
}

async function insertWeighmentBatch(
  table: "automatic_weighments" | "manual_weighments",
  pairedInEntries: Array<{ id: number }>,
  pairedOutEntries: Array<{ id: number }>,
): Promise<SeededWeighmentRow[]> {
  if (pairedInEntries.length !== pairedOutEntries.length) {
    throw new Error(
      `Mismatched ${table} pairs: ${pairedInEntries.length} in-entries vs ${pairedOutEntries.length} out-entries`,
    );
  }

  const inserts = pairedInEntries.map((inEntry, i) => ({
    in_entry_id: inEntry.id,
    out_entry_id: pairedOutEntries[i].id,
  }));

  const { data, error } = await supabase
    .from(table)
    .insert(inserts)
    .select("id, in_entry_id, out_entry_id, gross, tare, net, type");

  if (error || !data) {
    throw new Error(`Failed to seed ${table}: ${error?.message}`);
  }

  return data;
}

export async function seedWeighments({
  automatic,
  manual,
}: {
  automatic: EntryGroup<SeededAutomaticEntry>;
  manual: EntryGroup<SeededManualEntry>;
}): Promise<{
  automatic: SeededWeighmentRow[];
  manual: SeededWeighmentRow[];
}> {
  console.log(
    "\n🚛 [5/6] Seeding Automatic & Manual Weighment Pairs (invoking trigger_weighments_auto_populate)...",
  );

  const [createdAuto, createdManual] = await Promise.all([
    insertWeighmentBatch(
      "automatic_weighments",
      automatic.pairedInEntries,
      automatic.pairedOutEntries,
    ),
    insertWeighmentBatch("manual_weighments", manual.pairedInEntries, manual.pairedOutEntries),
  ]);

  console.log(
    `  ✓ Seeded ${createdAuto.length} automatic_weighments and ${createdManual.length} manual_weighments (gross, tare, net, type computed automatically).`,
  );

  return { automatic: createdAuto, manual: createdManual };
}
