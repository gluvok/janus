/**
 * @file scripts/seed-entry-photos.ts
 * @description Links sample transport photos to automatic entries in the database using Drizzle ORM.
 */

import { eq, asc } from "drizzle-orm";
import { db, schema } from "../db/client.ts";

// Realistic transport and weighbridge sample photos
const SAMPLE_PHOTOS = [
  "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1200&q=80",
];

async function seedPhotos() {
  console.log("🚚 Starting Entry Photos Seeding (Turso / Drizzle)...");

  // 1. Query recent automatic entries
  const entries = await db
    .select({
      id: schema.automatic_entries.id,
      vehicle_number: schema.automatic_entries.vehicle_number,
    })
    .from(schema.automatic_entries)
    .orderBy(asc(schema.automatic_entries.id))
    .limit(10);

  if (entries.length === 0) {
    console.error("❌ No automatic entries found to link photos.");
    return;
  }

  const assignments = [
    {
      id: entries[0]?.id,
      images: [SAMPLE_PHOTOS[0], SAMPLE_PHOTOS[1], SAMPLE_PHOTOS[2]],
    },
    { id: entries[1]?.id, images: [SAMPLE_PHOTOS[0], SAMPLE_PHOTOS[1]] },
    { id: entries[2]?.id, images: SAMPLE_PHOTOS },
    { id: entries[3]?.id, images: [SAMPLE_PHOTOS[0]] },
  ];

  for (const item of assignments) {
    if (!item.id || item.images.length === 0) continue;
    await db
      .update(schema.automatic_entries)
      .set({ images: item.images, updated_at: new Date().toISOString() })
      .where(eq(schema.automatic_entries.id, item.id));
    console.log(`📸 Updated Entry #${item.id} with ${item.images.length} photo(s).`);
  }

  console.log("🎉 Entry photos successfully seeded!");
}

seedPhotos().catch((err) => {
  console.error("❌ Seeding entry photos failed:", err);
  process.exit(1);
});
