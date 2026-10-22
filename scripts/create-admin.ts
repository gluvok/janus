/**
 * @file scripts/create-admin.ts
 * @description Dedicated script to create or update an admin user in Supabase.
 * Strictly accepts only a single factory_id argument.
 * Does not touch centers, weighments, commodities, or hardware accounts.
 */

import { createClient } from "@supabase/supabase-js";
import { Role } from "@/lib/constants/enums";
import { hashPassword } from "@/lib/auth/password";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Error: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY environment variables are required.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 1 || !/^\d+$/.test(args[0])) {
    console.error("Error: Exactly one argument (factory_id) is required and must be an integer.\n");
    console.error("Usage:");
    console.error("  pnpm seed:admin <factory_id>\n");
    console.error("Example:");
    console.error("  pnpm seed:admin 3\n");
    process.exit(1);
  }

  const factoryId = parseInt(args[0], 10);
  const username = "admin";
  const password = "admin123";
  const name = "Admin User";

  const { data: factory, error: factoryErr } = await supabase
    .from("factories")
    .select("id, name")
    .eq("id", factoryId)
    .maybeSingle();

  if (factoryErr) {
    throw new Error(`Failed to query factory: ${factoryErr.message}`);
  }

  if (!factory) {
    console.error(`Error: Factory with ID ${factoryId} does not exist in the database.`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const { data: existingUser, error: findUserErr } = await supabase
    .from("users")
    .select("id, username, role")
    .eq("username", username)
    .maybeSingle();

  if (findUserErr) {
    throw new Error(`Failed to query existing user: ${findUserErr.message}`);
  }

  if (existingUser) {
    const { error: updateErr } = await supabase
      .from("users")
      .update({
        password_hash: passwordHash,
        name,
        role: Role.ADMIN,
        factory_id: factoryId,
        deleted_at: null,
      })
      .eq("id", existingUser.id);

    if (updateErr) {
      throw new Error(`Failed to update admin user: ${updateErr.message}`);
    }

    console.log("Successfully updated admin user:");
    console.log(`  - ID: ${existingUser.id}`);
    console.log(`  - Username: ${username}`);
    console.log(`  - Role: ${Role.ADMIN}`);
    console.log(`  - Factory: ${factory.name} (ID: ${factoryId})`);
  } else {
    const { data: newUser, error: insertErr } = await supabase
      .from("users")
      .insert({
        username,
        password_hash: passwordHash,
        name,
        role: Role.ADMIN,
        factory_id: factoryId,
      })
      .select("id")
      .single();

    if (insertErr || !newUser) {
      throw new Error(`Failed to create admin user: ${insertErr?.message || "Unknown error"}`);
    }

    console.log("Successfully created admin user:");
    console.log(`  - ID: ${newUser.id}`);
    console.log(`  - Username: ${username}`);
    console.log(`  - Role: ${Role.ADMIN}`);
    console.log(`  - Factory: ${factory.name} (ID: ${factoryId})`);
  }
}

main().catch((err) => {
  console.error("Admin user creation failed:", err);
  process.exit(1);
});
