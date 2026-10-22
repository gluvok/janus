/**
 * @file lib/services/weighments/merge.ts
 * @description Logic for pairing and merging consecutive approved entries into weighment records.
 */

import { supabase } from "@/db";
import { EntryStatus, Role, Unit } from "@/lib/constants/enums";

export async function tryMergeEntries(
  client: typeof supabase,
  factoryId: number,
  entryId: number,
  existingEntry?: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  // 1. Fetch current entry E2 (or reuse provided existingEntry if valid)
  let e2 = existingEntry;
  if (!e2 || !e2.vehicle_number || !e2.created_at || e2.status !== EntryStatus.APPROVED) {
    const { data, error: fetchErr } = await client
      .from("entries")
      .select(
        "id, status, vehicle_number, created_at, created_by, center_id, centers!inner(factory_id), creator:users!created_by(role)",
      )
      .eq("id", entryId)
      .eq("centers.factory_id", factoryId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchErr || !data || data.status !== EntryStatus.APPROVED) {
      return null;
    }
    e2 = data;
  }

  const creatorRole =
    (e2.creator as { role?: string } | undefined)?.role ||
    (e2.created_by_user as { role?: string } | undefined)?.role;
  const isDevice =
    creatorRole === Role.HARDWARE || (e2 as { device_id?: number | null }).device_id != null;

  // 2. Fetch factory configuration and check if E2 is already linked in parallel
  const [factoryRes, w2Check] = await Promise.all([
    client
      .from("factories")
      .select("check_center_on_merge")
      .eq("id", factoryId)
      .is("deleted_at", null)
      .maybeSingle(),
    client
      .from("weighments")
      .select("id")
      .or(`in_entry_id.eq.${entryId},out_entry_id.eq.${entryId}`)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (w2Check.data) {
    return null;
  }

  const factory = factoryRes.data;

  // 3. Query E1 candidates
  let e1Query = client
    .from("entries")
    .select(
      "id, vehicle_number, weight, created_at, created_by, center_id, centers!inner(factory_id), creator:users!created_by!inner(role)",
    )
    .eq("centers.factory_id", factoryId)
    .eq("vehicle_number", e2.vehicle_number)
    .eq("status", EntryStatus.APPROVED)
    .lt("created_at", e2.created_at)
    .neq("id", entryId)
    .is("deleted_at", null);

  if (isDevice) {
    e1Query = e1Query.eq("creator.role", Role.HARDWARE);
  } else {
    e1Query = e1Query.neq("creator.role", Role.HARDWARE);
  }

  if (factory?.check_center_on_merge) {
    e1Query = e1Query.eq("center_id", e2.center_id);
  }

  const e1Res = await e1Query.order("created_at", { ascending: false }).limit(1);

  // 4. Try backward merge: look for an earlier unmerged entry (E1 In, E2 Out)
  if (!e1Res.error && e1Res.data && e1Res.data.length > 0) {
    const e1 = e1Res.data[0];

    const { data: existingW1 } = await client
      .from("weighments")
      .select("id")
      .or(`in_entry_id.eq.${e1.id},out_entry_id.eq.${e1.id}`)
      .is("deleted_at", null)
      .maybeSingle();

    if (!existingW1 && e1.id !== e2.id) {
      const { data: newWeighment, error: insertErr } = await client
        .from("weighments")
        .insert({
          in_entry_id: e1.id,
          out_entry_id: e2.id,
          unit: Unit.KG,
        })
        .select("*")
        .single();

      if (insertErr) {
        console.error("Failed to create weighment record:", insertErr);
        return null;
      }

      return newWeighment;
    }
  }

  // 5. Try forward merge: look for a later unmerged entry (E2 In, E_next Out)
  let eNextQuery = client
    .from("entries")
    .select(
      "id, vehicle_number, weight, created_at, created_by, center_id, centers!inner(factory_id), creator:users!created_by!inner(role)",
    )
    .eq("centers.factory_id", factoryId)
    .eq("vehicle_number", e2.vehicle_number)
    .eq("status", EntryStatus.APPROVED)
    .gt("created_at", e2.created_at)
    .neq("id", entryId)
    .is("deleted_at", null);

  if (isDevice) {
    eNextQuery = eNextQuery.eq("creator.role", Role.HARDWARE);
  } else {
    eNextQuery = eNextQuery.neq("creator.role", Role.HARDWARE);
  }

  if (factory?.check_center_on_merge) {
    eNextQuery = eNextQuery.eq("center_id", e2.center_id);
  }

  const { data: eNextCandidates, error: eNextErr } = await eNextQuery
    .order("created_at", { ascending: true })
    .limit(1);

  if (!eNextErr && eNextCandidates && eNextCandidates.length > 0) {
    const eNext = eNextCandidates[0];

    const { data: existingWNext } = await client
      .from("weighments")
      .select("id")
      .or(`in_entry_id.eq.${eNext.id},out_entry_id.eq.${eNext.id}`)
      .is("deleted_at", null)
      .maybeSingle();

    if (!existingWNext && e2.id !== eNext.id) {
      const { data: newWeighment, error: insertErr } = await client
        .from("weighments")
        .insert({
          in_entry_id: e2.id,
          out_entry_id: eNext.id,
          unit: Unit.KG,
        })
        .select("*")
        .single();

      if (insertErr) {
        console.error("Failed to create forward weighment record:", insertErr);
        return null;
      }

      return newWeighment;
    }
  }

  return null;
}
