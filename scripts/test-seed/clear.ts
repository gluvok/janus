/**
 * @file scripts/test-seed/clear.ts
 * @description Clears existing records in topological order and resets database sequences.
 */

import { supabase } from "../supabase.ts";
import { TABLES_IN_CLEAR_ORDER } from "./constants.ts";

export async function clearDatabase(): Promise<void> {
  console.log("🧹 [Clean Mode] Clearing all existing records in topological dependency order...");

  for (const table of TABLES_IN_CLEAR_ORDER) {
    const { error } = await supabase.from(table).delete().neq("id", 0);
    if (error) {
      throw new Error(`Failed to clear table '${table}': ${error.message}`);
    }
    console.log(`  ✓ Cleared table: ${table}`);
  }

  const { error: resetErr } = await supabase.rpc("reset_all_sequences");
  if (resetErr) {
    console.warn("  ⚠️ Could not invoke reset_all_sequences RPC:", resetErr.message);
  } else {
    console.log("  ✓ Reset all auto-increment sequences via reset_all_sequences().");
  }
}
