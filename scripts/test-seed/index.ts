/**
 * @file scripts/test-seed/index.ts
 * @description Master orchestrator for the modular high-volume test database seeder.
 */

import { SUPABASE_URL } from "../supabase.ts";
import { clearDatabase } from "./clear.ts";
import { seedFactories } from "./factories.ts";
import { seedUsers } from "./users.ts";
import { seedCenters } from "./centers.ts";
import { seedWeighments } from "./weighments.ts";
import { seedTickets } from "./tickets.ts";
import type { SeedContext } from "./types.ts";

async function main() {
  const args = process.argv.slice(2);
  const shouldClean =
    args.includes("--clean") || args.includes("--reset") || process.env.RESET === "true";

  console.log("=================================================");
  console.log("🚀 Starting Mesto Modular Test Database Seeder");
  console.log(`📡 Supabase Endpoint: ${SUPABASE_URL}`);
  console.log("=================================================");

  if (shouldClean) {
    await clearDatabase();
  }

  // 1. Factories
  const { primaryFactoryId, secondaryFactoryId } = await seedFactories();

  // 2. Users
  const userMap = await seedUsers({ primaryFactoryId, secondaryFactoryId });

  // 3. Centers
  const { primaryCenterIds, secondaryCenterIds, centerNameMap } = await seedCenters({
    primaryFactoryId,
    secondaryFactoryId,
  });

  const ctx: SeedContext = {
    primaryFactoryId,
    secondaryFactoryId,
    userMap,
    primaryCenterIds,
    secondaryCenterIds,
    centerNameMap,
  };

  // 4. Weighments with 100% Valid Unique SVG Photos
  const { createdAuto } = await seedWeighments(ctx);

  // 5. Support Tickets
  await seedTickets({ ctx, createdAuto });

  console.log("\n=================================================");
  console.log("🎉 Test database seeding complete with zero errors!");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("❌ Test seeding failed:", err);
  process.exit(1);
});
