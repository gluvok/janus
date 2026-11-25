/**
 * @file scripts/test-seed/factories.ts
 * @description Provisions core tenant factories strictly validating constraints and auto-generating API keys.
 */

import crypto from "node:crypto";
import { supabase } from "../supabase.ts";
import type { FactoryConfig } from "./types.ts";

export async function seedFactories(): Promise<{
  primaryFactoryId: number;
  secondaryFactoryId: number;
}> {
  console.log("\n🏭 [1/5] Ensuring Core Factories...");

  const factoryConfigs: FactoryConfig[] = [
    { name: "Meow Meow factory name", receipt_images_per_row: 2 },
    { name: "Apex Agro Logistics", receipt_images_per_row: 2 },
  ];

  const targetFactoryNames = factoryConfigs.map((f) => f.name);
  const { data: existingFactories, error: existingFactoriesErr } = await supabase
    .from("factories")
    .select("id, name")
    .in("name", targetFactoryNames);

  if (existingFactoriesErr) throw existingFactoriesErr;

  const factoryMap = new Map<string, number>();
  for (const f of existingFactories ?? []) {
    factoryMap.set(f.name, f.id);
  }

  const missingFactories = factoryConfigs.filter((f) => !factoryMap.has(f.name));
  if (missingFactories.length > 0) {
    const factoriesToInsert = missingFactories.map((f) => ({
      name: f.name,
      receipt_images_per_row: f.receipt_images_per_row,
      api_key: f.api_key ?? crypto.randomBytes(16).toString("hex"),
    }));

    const { data: createdFactories, error: insertFactoriesErr } = await supabase
      .from("factories")
      .insert(factoriesToInsert)
      .select("id, name, api_key");

    if (insertFactoriesErr || !createdFactories) throw insertFactoriesErr;
    for (const f of createdFactories) {
      factoryMap.set(f.name, f.id);
    }
  }

  const primaryFactoryId = factoryMap.get("Meow Meow factory name")!;
  const secondaryFactoryId = factoryMap.get("Apex Agro Logistics")!;
  console.log(`  ✓ Factories ready (Alpha: ${primaryFactoryId}, Apex: ${secondaryFactoryId})`);

  return { primaryFactoryId, secondaryFactoryId };
}
