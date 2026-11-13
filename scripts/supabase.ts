/**
 * @file scripts/supabase.ts
 * @description Dedicated Supabase client for CLI scripts and database seeding.
 * Loads local environment variables before client instantiation.
 */

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

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

const envSchema = z.object({
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_PUBLISHABLE_KEY is required"),
});

const parsedEnv = envSchema.safeParse({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY,
});

if (!parsedEnv.success) {
  console.error("❌ Environment configuration error:");
  for (const issue of parsedEnv.error.issues) {
    console.error(`   • ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const supabase = createClient(parsedEnv.data.SUPABASE_URL, parsedEnv.data.SUPABASE_KEY);
export const SUPABASE_URL = parsedEnv.data.SUPABASE_URL;
