/**
 * @file scripts/test-seed/users.ts
 * @description Provisions tenant users covering all 4 role_enum variants.
 */

import argon2 from "argon2";
import { supabase } from "../supabase.ts";
import type { UserConfig } from "./types.ts";

export async function seedUsers({
  primaryFactoryId,
  secondaryFactoryId,
}: {
  primaryFactoryId: number;
  secondaryFactoryId: number;
}): Promise<Map<string, number>> {
  console.log("\n👥 [2/5] Seeding Users with all role_enum variants...");

  const [adminHash, managerHash, operatorHash, baseHash] = await Promise.all([
    argon2.hash("admin123"),
    argon2.hash("manager123"),
    argon2.hash("operator123"),
    argon2.hash("base123"),
  ]);

  const userConfigs: UserConfig[] = [
    // Factory 1 Users (Alpha)
    {
      username: "admin1",
      name: "System Administrator",
      role: "admin",
      password_hash: adminHash,
      factory_id: primaryFactoryId,
    },
    {
      username: "manager1",
      name: "Operations Manager Alpha",
      role: "manager",
      password_hash: managerHash,
      factory_id: primaryFactoryId,
    },
    {
      username: "operator1",
      name: "Main Scale Operator Alpha",
      role: "operator",
      password_hash: operatorHash,
      factory_id: primaryFactoryId,
    },
    {
      username: "operator2",
      name: "Inbound Gate Operator Alpha",
      role: "operator",
      password_hash: operatorHash,
      factory_id: primaryFactoryId,
    },
    {
      username: "base1",
      name: "Floor Associate Alpha",
      role: "base",
      password_hash: baseHash,
      factory_id: primaryFactoryId,
    },
    // Factory 2 Users (Apex)
    {
      username: "admin2",
      name: "Admin Apex Logistics",
      role: "admin",
      password_hash: adminHash,
      factory_id: secondaryFactoryId,
    },
    {
      username: "manager2",
      name: "Apex Logistics Manager",
      role: "manager",
      password_hash: managerHash,
      factory_id: secondaryFactoryId,
    },
    {
      username: "operatorApex1",
      name: "Apex Gate Operator",
      role: "operator",
      password_hash: operatorHash,
      factory_id: secondaryFactoryId,
    },
    {
      username: "base2",
      name: "Floor Associate Apex",
      role: "base",
      password_hash: baseHash,
      factory_id: secondaryFactoryId,
    },
  ];

  const targetUsernames = userConfigs.map((u) => u.username);
  const { data: existingUsers, error: existingUsersErr } = await supabase
    .from("users")
    .select("id, username")
    .in("username", targetUsernames);

  if (existingUsersErr) throw existingUsersErr;

  const userMap = new Map<string, number>();
  for (const u of existingUsers ?? []) {
    userMap.set(u.username, u.id);
  }

  const missingUsers = userConfigs.filter((u) => !userMap.has(u.username));
  if (missingUsers.length > 0) {
    const { data: createdUsers, error: insertUsersErr } = await supabase
      .from("users")
      .insert(missingUsers)
      .select("id, username");

    if (insertUsersErr || !createdUsers) throw insertUsersErr;
    for (const u of createdUsers) {
      userMap.set(u.username, u.id);
    }
  }

  console.log(`  ✓ Users ready: ${userMap.size} users across 4 roles.`);
  return userMap;
}
