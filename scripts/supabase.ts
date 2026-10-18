/**
 * @file scripts/supabase.ts
 * @description Dedicated Supabase client for CLI scripts and database seeding.
 * Loads local environment variables before client instantiation.
 */

import { createClient } from "@supabase/supabase-js";

if (process.loadEnvFile) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    try {
      process.loadEnvFile(".env");
    } catch {
      // Ignore if env files are missing
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Error: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required.",
  );
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey);
