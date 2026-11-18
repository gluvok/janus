/**
 * @file scripts/mock-customer-entry.ts
 * @description Injects a mock vehicle entry for customer Ramesh Kumar into Supabase
 * to trigger real-time notifications via Supabase Realtime in the running UI.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const plate = process.argv[2] || "KA05MK8888";
  const weight = Number(process.argv[3]) || 38450;

  console.log(`Injecting entry for customer Ramesh Kumar (Plate: ${plate}, Weight: ${weight} kg)...`);

  // 1. Get Customer Ramesh Kumar (id: 1)
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("id, factory_id")
    .eq("name", "Ramesh Kumar")
    .single();

  if (custErr || !customer) {
    console.error("Customer Ramesh Kumar not found in database.");
    process.exit(1);
  }

  // 2. Insert new weighment entry
  const { data: entry, error: entryErr } = await supabase
    .from("entries")
    .insert({
      detected_vehicle_number: plate,
      vehicle_number: plate,
      weight,
      status: "pending",
      center_id: 1, // Main Weighbridge
      customer_id: customer.id,
      created_by: 1, // Admin User 1
      images: [
        "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=600&auto=format&fit=crop&q=60",
      ],
    })
    .select("id, vehicle_number, weight, created_at")
    .single();

  if (entryErr || !entry) {
    console.error("Failed to insert customer entry:", entryErr);
    process.exit(1);
  }

  console.log("✅ Successfully injected customer weighment entry!");
  console.log(`   Entry ID:       ${entry.id}`);
  console.log(`   Vehicle Number: ${entry.vehicle_number}`);
  console.log(`   Weight:         ${entry.weight} kg`);
  console.log(`   Customer:       Ramesh Kumar (ID: ${customer.id})`);
  console.log("📡 Realtime broadcast sent to connected browsers via 'entries' table.");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
