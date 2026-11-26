/**
 * @file lib/supabase.ts
 * @description Initializes and configures the server-side Supabase SDK instance using environment credentials.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder.supabase.co";

const supabaseKey = process.env.SUPABASE_SECRET_KEY || "placeholder-key";

/**
 * supabase client instance
 * Server-side client connection instance used for database and storage operations.
 */
export const supabase = createClient(supabaseUrl, supabaseKey);
