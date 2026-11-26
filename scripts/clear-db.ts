/**
 * @file scripts/clear-db.ts
 * @description Clears/truncates data from all tables using Supabase JS client in proper dependency order.
 */

import { createClient } from "@supabase/supabase-js";
import { TABLES_IN_CLEAR_ORDER } from "./fixtures/seed-data";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase URL and key environment variables are required.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Clearing all data from Supabase tables...");
  for (const table of TABLES_IN_CLEAR_ORDER) {
    const { error } = await supabase.from(table).delete().neq("id", 0);
    if (error) {
      if (error.code === "PGRST205") {
        console.warn(
          `Could not clear table '${table}': Table does not exist in Supabase database schema (PGRST205). Please run 'schema.sql' in Supabase SQL Editor to create it.`,
        );
      } else {
        console.warn(`Could not clear table ${table}:`, error.message);
      }
    } else {
      console.log(`Cleared table: ${table}`);
    }

    const { error: seqError } = await supabase.rpc("reset_table_sequence", { table_name: table });
    if (!seqError) {
      console.log(`Reset sequence/index for table: ${table}`);
    }
  }

  const { error: resetAllErr } = await supabase.rpc("reset_all_sequences");
  if (!resetAllErr) {
    console.log("Reset all auto-increment sequence indexes successfully.");
  }

  console.log("Database cleared successfully!");
}

main().catch((err) => {
  console.error("Database clear failed:", err);
  process.exit(1);
});
