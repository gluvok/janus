/**
 * @file scripts/test-seed/centers.ts
 * @description Provisions weighing centers with dedicated API keys partitioned by factory.
 */

import { generateApiKey, hashApiKey } from "../../lib/api-key.ts";
import { supabase } from "../supabase.ts";
import type { CenterConfig } from "./types.ts";

export async function seedCenters({
  primaryFactoryId,
  secondaryFactoryId,
}: {
  primaryFactoryId: number;
  secondaryFactoryId: number;
}): Promise<{
  primaryCenterIds: number[];
  secondaryCenterIds: number[];
  centerNameMap: Map<number, string>;
}> {
  console.log("\n⚖️ [3/5] Seeding Centers strictly partitioned by factory...");

  const centerConfigs: CenterConfig[] = [
    { name: "North Weighbridge", factory_id: primaryFactoryId },
    { name: "South Inbound Scale", factory_id: primaryFactoryId },
    { name: "East Gate Outbound", factory_id: primaryFactoryId },
    { name: "Terminal 1 Bulk Scale", factory_id: primaryFactoryId },
    { name: "Terminal 2 Silo Platform", factory_id: primaryFactoryId },
    { name: "Apex Central Scale", factory_id: secondaryFactoryId },
    { name: "Apex Dockside Weighbridge", factory_id: secondaryFactoryId },
    { name: "Apex West Gate", factory_id: secondaryFactoryId },
  ];

  const targetCenterNames = centerConfigs.map((c) => c.name);
  const { data: existingCenters, error: existingCentersErr } = await supabase
    .from("centers")
    .select("id, name, factory_id")
    .in("name", targetCenterNames);

  if (existingCentersErr) throw existingCentersErr;

  const centerMap = new Map<string, number>();
  const centerNameMap = new Map<number, string>();

  for (const c of existingCenters ?? []) {
    centerMap.set(`${c.factory_id}:${c.name}`, c.id);
    centerNameMap.set(c.id, c.name);
  }

  // Plain keys live only here; the DB stores their SHA-256.
  const missingKeys = new Map(
    centerConfigs
      .filter((c) => !centerMap.has(`${c.factory_id}:${c.name}`))
      .map((c) => [`${c.factory_id}:${c.name}`, { ...c, apiKey: generateApiKey() }]),
  );
  const missingCenters = [...missingKeys.values()].map(({ name, factory_id, apiKey }) => ({
    name,
    factory_id,
    api_key_hash: hashApiKey(apiKey),
  }));

  if (missingCenters.length > 0) {
    const { data: createdCenters, error: insertCentersErr } = await supabase
      .from("centers")
      .insert(missingCenters)
      .select("id, name, factory_id");

    if (insertCentersErr || !createdCenters) throw insertCentersErr;
    for (const c of createdCenters) {
      centerMap.set(`${c.factory_id}:${c.name}`, c.id);
      centerNameMap.set(c.id, c.name);
      console.log(
        `  ✓ Center '${c.name}' (ID: ${c.id}) ➜ API Key: ${missingKeys.get(`${c.factory_id}:${c.name}`)?.apiKey}`,
      );
    }
  }

  const primaryCenterIds = [
    centerMap.get(`${primaryFactoryId}:North Weighbridge`)!,
    centerMap.get(`${primaryFactoryId}:South Inbound Scale`)!,
    centerMap.get(`${primaryFactoryId}:East Gate Outbound`)!,
    centerMap.get(`${primaryFactoryId}:Terminal 1 Bulk Scale`)!,
    centerMap.get(`${primaryFactoryId}:Terminal 2 Silo Platform`)!,
  ];

  const secondaryCenterIds = [
    centerMap.get(`${secondaryFactoryId}:Apex Central Scale`)!,
    centerMap.get(`${secondaryFactoryId}:Apex Dockside Weighbridge`)!,
    centerMap.get(`${secondaryFactoryId}:Apex West Gate`)!,
  ];

  console.log(
    `  ✓ Centers ready: ${primaryCenterIds.length} for Alpha, ${secondaryCenterIds.length} for Apex.`,
  );

  return { primaryCenterIds, secondaryCenterIds, centerNameMap };
}
