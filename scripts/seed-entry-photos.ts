/**
 * @file scripts/seed-entry-photos.ts
 * @description Uploads sample transport photos to the 'mesto' Supabase storage bucket
 * and links their public URLs to weighments in the database.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Realistic transport and weighbridge sample photos
const SAMPLE_PHOTOS = [
  {
    name: "entry_truck_front.jpg",
    url: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1200&q=80",
    label: "Front Vehicle View (MH12AB1001)",
  },
  {
    name: "entry_weighbridge_scale.jpg",
    url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
    label: "Gross Scale Platform & Axle Reading",
  },
  {
    name: "entry_cargo_inspection.jpg",
    url: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1200&q=80",
    label: "Rear Cargo Inspection (Bagged Grain)",
  },
  {
    name: "entry_delivery_manifest.jpg",
    url: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1200&q=80",
    label: "Signed Weighbridge Delivery Slip",
  },
];

async function seedPhotos() {
  console.log("🚚 Starting Weighment Photos Seeding...");
  console.log(`📡 Supabase Endpoint: ${supabaseUrl}`);

  // 1. Fetch images as buffers
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
        const { data: publicUrlData } = supabase.storage.from("mesto").getPublicUrl(`1/${photo.name}`);
        console.log(`✅ Uploaded to bucket 'mesto': ${publicUrlData.publicUrl}`);
        uploadedUrls.push(publicUrlData.publicUrl);
      }
    } catch (err) {
      console.warn(`Error processing photo ${photo.name}:`, err);
      uploadedUrls.push(photo.url);
    }
  }

  // 2. Link photos to recent weighments
  console.log("📝 Querying recent weighments to update with photos...");
  const { data: weighments, error: weighmentsError } = await supabase
    .from("automatic_weighments")
    .select("id, vehicle_number")
    .order("id", { ascending: true })
    .limit(10);

  if (weighmentsError || !weighments || weighments.length === 0) {
    console.error("❌ Could not fetch weighments to link photos:", weighmentsError);
    return;
  }

  const assignments = [
    {
      id: weighments[0]?.id,
      images: [uploadedUrls[0], uploadedUrls[1], uploadedUrls[2]].filter(Boolean),
    },
    { id: weighments[1]?.id, images: [uploadedUrls[0], uploadedUrls[1]].filter(Boolean) },
    { id: weighments[2]?.id, images: uploadedUrls.filter(Boolean) },
    { id: weighments[3]?.id, images: [uploadedUrls[0]].filter(Boolean) },
  ];

  for (const item of assignments) {
    if (!item.id || item.images.length === 0) continue;
    const { error: updateError } = await supabase
      .from("automatic_weighments")
      .update({ images: item.images })
      .eq("id", item.id);

    if (updateError) {
      console.error(`❌ Failed to update Weighment #${item.id}:`, updateError.message);
    } else {
      console.log(`📸 Updated Weighment #${item.id} with ${item.images.length} photo(s).`);
    }
  }

  console.log("🎉 Weighment photos successfully seeded!");
}

seedPhotos();
