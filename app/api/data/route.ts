import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { StatusCodes, ReasonPhrases } from "http-status-codes";
import { db } from "@/db";
import { formatWeighmentRecord } from "@/lib/services/weighments";

const BATCH_SIZE = 1000;
const ENTRY_BATCH_SIZE = 500;

function isValidApiKey(request: NextRequest): boolean {
  const secretKey = process.env.DATA_API_KEY || process.env.API_KEY;
  if (!secretKey) {
    return false;
  }

  const clientKey = request.headers.get("x-api-key");
  if (!clientKey) {
    return false;
  }

  const clientBuffer = Buffer.from(clientKey);
  const secretBuffer = Buffer.from(secretKey);

  if (clientBuffer.length !== secretBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(clientBuffer, secretBuffer);
}

export async function GET(request: NextRequest) {
  if (!isValidApiKey(request)) {
    return NextResponse.json(
      { error: ReasonPhrases.UNAUTHORIZED },
      { status: StatusCodes.UNAUTHORIZED },
    );
  }

  try {
    const allRecords: Record<string, unknown>[] = [];
    let from = 0;
    let hasMore = true;

    // 1. Fetch all automatic weighment records in batches
    while (hasMore) {
      const { data, error } = await db
        .from("automatic_weighments")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, from + BATCH_SIZE - 1);

      if (error) {
        console.error("Database error while fetching automatic_weighments:", error);
        return NextResponse.json(
          { error: error.message || "Database query failed" },
          { status: StatusCodes.INTERNAL_SERVER_ERROR },
        );
      }

      if (!data || data.length === 0) {
        break;
      }

      allRecords.push(...data);

      if (data.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        from += BATCH_SIZE;
      }
    }

    if (allRecords.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        data: [],
      });
    }

    // 2. Collect all referenced entry IDs
    const entryIds = Array.from(
      new Set(
        allRecords
          .flatMap((r) => [r.in_entry_id as number, r.out_entry_id as number])
          .filter((id): id is number => typeof id === "number" && id > 0),
      ),
    );

    // 3. Batch-fetch linked entries from automatic_entries (or fallback to entries)
    const rawEntries: Record<string, unknown>[] = [];

    for (let i = 0; i < entryIds.length; i += ENTRY_BATCH_SIZE) {
      const chunk = entryIds.slice(i, i + ENTRY_BATCH_SIZE);

      // Check automatic_entries first
      let { data: entries, error: entriesErr } = await db
        .from("automatic_entries")
        .select("*")
        .in("id", chunk);

      // If automatic_entries does not exist in schema, fallback to entries table
      if (entriesErr || !entries) {
        const fallback = await db.from("entries").select("*").in("id", chunk);
        entries = fallback.data as Record<string, unknown>[] | null;
      }

      if (entries) {
        rawEntries.push(...(entries as Record<string, unknown>[]));
      }
    }

    // 4. Batch-fetch centers, customers, and users for metadata enrichment
    const centerIds = Array.from(
      new Set(
        rawEntries
          .map((e) => e.center_id as number)
          .filter((id): id is number => typeof id === "number" && id > 0),
      ),
    );
    const customerIds = Array.from(
      new Set(
        rawEntries
          .map((e) => e.customer_id as number)
          .filter((id): id is number => typeof id === "number" && id > 0),
      ),
    );
    const userIds = Array.from(
      new Set(
        rawEntries
          .map((e) => (e.created_by ?? e.device_id) as number)
          .filter((id): id is number => typeof id === "number" && id > 0),
      ),
    );

    const [centersRes, customersRes, usersRes] = await Promise.all([
      centerIds.length > 0
        ? db.from("centers").select("id, name").in("id", centerIds)
        : Promise.resolve({ data: [] }),
      customerIds.length > 0
        ? db.from("customers").select("id, name").in("id", customerIds)
        : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? db.from("users").select("id, name").in("id", userIds)
        : Promise.resolve({ data: [] }),
    ]);

    const centersMap = new Map<number, string>(
      (centersRes.data || []).map((c: { id: number; name: string }) => [c.id, c.name]),
    );
    const customersMap = new Map<number, string>(
      (customersRes.data || []).map((c: { id: number; name: string }) => [c.id, c.name]),
    );
    const usersMap = new Map<number, string>(
      (usersRes.data || []).map((u: { id: number; name: string }) => [u.id, u.name]),
    );

    // Map enriched entries by ID
    const entriesMap = new Map<number, Record<string, unknown>>();
    for (const entry of rawEntries) {
      const centerId = entry.center_id as number | undefined;
      const customerId = entry.customer_id as number | undefined;
      const userId = (entry.created_by ?? entry.device_id) as number | undefined;

      entriesMap.set(entry.id as number, {
        ...entry,
        centers: { name: (centerId ? centersMap.get(centerId) : undefined) || "" },
        customers: { name: (customerId ? customersMap.get(customerId) : undefined) || "" },
        users: { name: (userId ? usersMap.get(userId) : undefined) || "" },
      });
    }

    // 5. Attach linked entries and format records
    const enrichedRecords = allRecords.map((record) => {
      const inEntry = entriesMap.get(record.in_entry_id as number) || {};
      const outEntry = entriesMap.get(record.out_entry_id as number) || {};

      return formatWeighmentRecord({
        ...record,
        in_entry: inEntry,
        out_entry: outEntry,
      });
    });

    return NextResponse.json({
      success: true,
      total: enrichedRecords.length,
      data: enrichedRecords,
    });
  } catch (error: unknown) {
    console.error("Unexpected error in GET /api/data:", error);
    const errObj = error as { message?: string };
    return NextResponse.json(
      { error: errObj.message || "Internal server error" },
      { status: StatusCodes.INTERNAL_SERVER_ERROR },
    );
  }
}
