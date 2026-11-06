/**
 * @file scripts/seed-weighment-photos.ts
 * @description Uploads sample transport photos to the 'mesto' Supabase storage bucket
 * and links their public URLs to automatic and manual weighments in the database.
 */

import { supabase } from "./supabase.ts";

const SAMPLE_PHOTOS = [
  {
    name: "weighment_truck_front.jpg",
    url: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1200&q=80",
    label: "Front Vehicle View (MH12AB1001)",
  },
  {
    name: "weighment_scale_platform.jpg",
    url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
    label: "Gross Scale Platform & Axle Reading",
  },
  {
    name: "weighment_cargo_inspection.jpg",
    url: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1200&q=80",
    label: "Rear Cargo Inspection (Bagged Grain)",
  },
  {
    name: "weighment_delivery_manifest.jpg",
    url: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1200&q=80",
    label: "Signed Weighbridge Delivery Slip",
  },
];

async function seedPhotos() {
  console.log("🚚 Starting Weighment Photos Seeding...");
  console.log(`📡 Supabase Endpoint: ${process.env.SUPABASE_URL}`);

  // 1. Fetch images as buffers and upload to storage (or use direct fallback CDN URL)
  const uploadedUrls: string[] = [];

  for (const photo of SAMPLE_PHOTOS) {
    try {
      console.log(`⬇️ Downloading sample asset: ${photo.name}...`);
      const res = await fetch(photo.url);
      if (!res.ok) {
        console.warn(`Failed to fetch ${photo.url}, status: ${res.status}`);
        uploadedUrls.push(photo.url);
        continue;
      }
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`⬆️ Uploading to Supabase Storage bucket 'mesto': ${photo.name}...`);
      const uploadRes = await supabase.storage.from("mesto").upload(`1/${photo.name}`, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

      if (uploadRes.error) {
        console.warn(`⚠️ Storage upload for ${photo.name} failed (${uploadRes.error.message}).`);
        console.warn(`ℹ️ Using direct fallback CDN URL: ${photo.url}`);
        uploadedUrls.push(photo.url);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from("mesto")
          .getPublicUrl(`1/${photo.name}`);
        console.log(`✅ Uploaded to bucket 'mesto': ${publicUrlData.publicUrl}`);
        uploadedUrls.push(publicUrlData.publicUrl);
      }
    } catch (err) {
      console.warn(`Error processing photo ${photo.name}:`, err);
      uploadedUrls.push(photo.url);
    }
  }

  // 2. Link photos to recent automatic weighments
  console.log("📝 Querying recent automatic weighments to update with photos...");
  const { data: autoWeighments, error: autoErr } = await supabase
    .from("automatic_weighments")
    .select("id, vehicle_number")
    .order("id", { ascending: true })
    .limit(10);

  if (autoErr || !autoWeighments || autoWeighments.length === 0) {
    console.warn("⚠️ No automatic weighments found to link photos.");
  } else {
    const autoAssignments = [
      { id: autoWeighments[0]?.id, images: uploadedUrls.slice(0, 3) },
      { id: autoWeighments[1]?.id, images: uploadedUrls.slice(0, 2) },
      { id: autoWeighments[2]?.id, images: uploadedUrls },
      { id: autoWeighments[3]?.id, images: uploadedUrls.slice(0, 1) },
    ];

    for (const item of autoAssignments) {
      if (!item.id || item.images.length === 0) continue;
      const { error: updateError } = await supabase
        .from("automatic_weighments")
        .update({ images: item.images })
        .eq("id", item.id);

      if (updateError) {
        console.error(`❌ Failed to update Automatic Weighment #${item.id}:`, updateError.message);
      } else {
        console.log(
          `📸 Updated Automatic Weighment #${item.id} with ${item.images.length} photo(s).`,
        );
      }
    }
  }

  // 3. Link photos to recent manual weighments
  console.log("📝 Querying recent manual weighments to update with photos...");
  const { data: manualWeighments, error: manualErr } = await supabase
    .from("manual_weighments")
    .select("id, vehicle_number")
    .order("id", { ascending: true })
    .limit(10);

  if (manualErr || !manualWeighments || manualWeighments.length === 0) {
    console.warn("⚠️ No manual weighments found to link photos.");
  } else {
    const manualAssignments = [
      { id: manualWeighments[0]?.id, images: uploadedUrls.slice(0, 2) },
      { id: manualWeighments[1]?.id, images: uploadedUrls.slice(1, 3) },
      { id: manualWeighments[2]?.id, images: uploadedUrls.slice(0, 1) },
    ];

    for (const item of manualAssignments) {
      if (!item.id || item.images.length === 0) continue;
      const { error: updateError } = await supabase
        .from("manual_weighments")
        .update({ images: item.images })
        .eq("id", item.id);

      if (updateError) {
        console.error(`❌ Failed to update Manual Weighment #${item.id}:`, updateError.message);
      } else {
        console.log(`📸 Updated Manual Weighment #${item.id} with ${item.images.length} photo(s).`);
      }
    }
  }

  console.log("🎉 Weighment photos successfully seeded!");
}

seedPhotos().catch((err) => {
  console.error("❌ Seeding photos failed:", err);
  process.exit(1);
});
