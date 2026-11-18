/**
 * @file lib/supabase.ts
 * @description Initializes and configures the server-side Supabase SDK instance using environment credentials.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://placeholder.supabase.co";

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "placeholder-key";

/**
 * supabase client instance
 * Server-side client connection instance used for database and storage operations.
 */
export const supabase = createClient(supabaseUrl, supabaseKey);
