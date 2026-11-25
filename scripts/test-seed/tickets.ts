/**
 * @file scripts/test-seed/tickets.ts
 * @description Provisions automatic and manual support tickets across both factories,
 * covering paired-in, paired-out, and standalone entries across all ticket_status variants.
 */

import { supabase } from "../supabase.ts";
import { daysAgo } from "./constants.ts";
import type { EntryGroup, SeededAutomaticEntry, SeededManualEntry } from "./entries.ts";
import type { SeedContext } from "./types.ts";

type TicketStatus = "pending" | "approved" | "rejected";
type EntryBucket = "pairedIn" | "pairedOut" | "standalone";

interface TicketSpec {
  concern: string;
  reply: string | null;
  status: TicketStatus;
  entry_id: number;
  creator_id: number;
  created_at: string;
  updated_at: string;
}

interface TicketTemplate {
  bucket: EntryBucket;
  entryIndex: number;
  status: TicketStatus;
  daysBack: number;
  createdMinutesOffset: number;
  replyDelayMinutes: number;
  buildConcern: (mode: "automatic" | "manual", entryId: number, vehicle: string) => string;
  reply: string | null;
}

function getRequiredUserId(userMap: Map<string, number>, username: string): number {
  const id = userMap.get(username);
  if (id === undefined) {
    throw new Error(`Missing required seeded user '${username}' in userMap.`);
  }
  return id;
}

function partitionByFactory<T extends { center_id: number }>(
  group: EntryGroup<T>,
  centerIds: number[],
): EntryGroup<T> {
  const centerSet = new Set(centerIds);
  return {
    pairedInEntries: group.pairedInEntries.filter((e) => centerSet.has(e.center_id)),
    pairedOutEntries: group.pairedOutEntries.filter((e) => centerSet.has(e.center_id)),
    standaloneEntries: group.standaloneEntries.filter((e) => centerSet.has(e.center_id)),
  };
}

function pickTicketCreator(
  factoryUserIds: number[],
  excludedCreatorId: number | undefined,
  seedIndex: number,
): number {
  const candidates =
    excludedCreatorId === undefined
      ? factoryUserIds
      : factoryUserIds.filter((id) => id !== excludedCreatorId);

  if (candidates.length === 0) {
    throw new Error(`No eligible ticket creator available excluding user #${excludedCreatorId}.`);
  }

  return candidates[seedIndex % candidates.length];
}

const FACTORY_1_TEMPLATES: TicketTemplate[] = [
  {
    bucket: "pairedIn",
    entryIndex: 3,
    status: "approved",
    daysBack: 1,
    createdMinutesOffset: 45,
    replyDelayMinutes: 25,
    buildConcern: (mode, entryId, vehicle) =>
      `Camera OCR misread plate on inbound ${mode} entry #${entryId} (${vehicle}). Verified against gate register.`,
    reply: "Plate verified against gate register and confirmed in weighment record.",
  },
  {
    bucket: "pairedIn",
    entryIndex: 6,
    status: "pending",
    daysBack: 2,
    createdMinutesOffset: 90,
    replyDelayMinutes: 0,
    buildConcern: (mode, entryId, vehicle) =>
      `High wind caused scale oscillation during inbound ${mode} capture #${entryId} for ${vehicle}.`,
    reply: null,
  },
  {
    bucket: "pairedIn",
    entryIndex: 9,
    status: "rejected",
    daysBack: 3,
    createdMinutesOffset: 140,
    replyDelayMinutes: 40,
    buildConcern: (mode, entryId, vehicle) =>
      `Driver requested moisture deduction on inbound ${mode} entry #${entryId} (${vehicle}).`,
    reply: "Rejected. Standard moisture tolerance already applied at intake inspection.",
  },
  {
    bucket: "pairedOut",
    entryIndex: 4,
    status: "approved",
    daysBack: 1,
    createdMinutesOffset: 25,
    replyDelayMinutes: 15,
    buildConcern: (mode, entryId, vehicle) =>
      `Rear axle positioned slightly off-pad on outbound ${mode} entry #${entryId} (${vehicle}).`,
    reply: "Auxiliary axle check confirmed net tolerance within 15 kg; approved.",
  },
  {
    bucket: "pairedOut",
    entryIndex: 7,
    status: "rejected",
    daysBack: 2,
    createdMinutesOffset: 65,
    replyDelayMinutes: 30,
    buildConcern: (mode, entryId, vehicle) =>
      `Dispatch manifest weight differs from outbound ${mode} reading #${entryId} (${vehicle}).`,
    reply: "Rejected. Weighbridge calibration verified; dispatch sheet had stale tare.",
  },
  {
    bucket: "pairedOut",
    entryIndex: 10,
    status: "pending",
    daysBack: 3,
    createdMinutesOffset: 110,
    replyDelayMinutes: 0,
    buildConcern: (mode, entryId, vehicle) =>
      `Tarpaulin and dunnage left on trailer during outbound ${mode} entry #${entryId} (${vehicle}).`,
    reply: null,
  },
  {
    bucket: "standalone",
    entryIndex: 1,
    status: "pending",
    daysBack: 1,
    createdMinutesOffset: 20,
    replyDelayMinutes: 0,
    buildConcern: (mode, entryId, vehicle) =>
      `Unmatched standalone ${mode} entry #${entryId} (${vehicle}) awaiting outbound gate departure.`,
    reply: null,
  },
  {
    bucket: "standalone",
    entryIndex: 2,
    status: "approved",
    daysBack: 2,
    createdMinutesOffset: 45,
    replyDelayMinutes: 20,
    buildConcern: (mode, entryId, vehicle) =>
      `Gate barrier delayed capture photo sync for standalone ${mode} entry #${entryId} (${vehicle}).`,
    reply: "Photos reconciled from local NVR buffer and linked to entry.",
  },
  {
    bucket: "standalone",
    entryIndex: 3,
    status: "rejected",
    daysBack: 3,
    createdMinutesOffset: 75,
    replyDelayMinutes: 35,
    buildConcern: (mode, entryId, vehicle) =>
      `Operator requested voiding standalone ${mode} entry #${entryId} (${vehicle}) as duplicate pull-in.`,
    reply: "Rejected. Entry timestamps are 45 minutes apart with distinct load weights.",
  },
];

const FACTORY_2_TEMPLATES: TicketTemplate[] = [
  {
    bucket: "pairedIn",
    entryIndex: 3,
    status: "approved",
    daysBack: 1,
    createdMinutesOffset: 40,
    replyDelayMinutes: 20,
    buildConcern: (mode, entryId, vehicle) =>
      `Dockside fog blurred front plate on inbound ${mode} entry #${entryId} (${vehicle}).`,
    reply: "Manual gate log cross-check confirmed vehicle registration.",
  },
  {
    bucket: "pairedIn",
    entryIndex: 6,
    status: "pending",
    daysBack: 2,
    createdMinutesOffset: 85,
    replyDelayMinutes: 0,
    buildConcern: (mode, entryId, vehicle) =>
      `Trailer seal mismatch noted at Apex inbound ${mode} entry #${entryId} (${vehicle}).`,
    reply: null,
  },
  {
    bucket: "pairedOut",
    entryIndex: 4,
    status: "rejected",
    daysBack: 1,
    createdMinutesOffset: 25,
    replyDelayMinutes: 15,
    buildConcern: (mode, entryId, vehicle) =>
      `Carrier disputed tare readout on Apex outbound ${mode} entry #${entryId} (${vehicle}).`,
    reply: "Rejected. Zero-balance check before and after weighment passed within tolerance.",
  },
  {
    bucket: "pairedOut",
    entryIndex: 7,
    status: "approved",
    daysBack: 2,
    createdMinutesOffset: 55,
    replyDelayMinutes: 25,
    buildConcern: (mode, entryId, vehicle) =>
      `Container chassis swap between gates flagged on outbound ${mode} entry #${entryId} (${vehicle}).`,
    reply: "Chassis swap verified by yard supervisor; weighment approved.",
  },
  {
    bucket: "standalone",
    entryIndex: 1,
    status: "pending",
    daysBack: 1,
    createdMinutesOffset: 25,
    replyDelayMinutes: 0,
    buildConcern: (mode, entryId, vehicle) =>
      `Standalone Apex ${mode} entry #${entryId} (${vehicle}) parked overnight awaiting unloading bay.`,
    reply: null,
  },
  {
    bucket: "standalone",
    entryIndex: 2,
    status: "rejected",
    daysBack: 2,
    createdMinutesOffset: 50,
    replyDelayMinutes: 20,
    buildConcern: (mode, entryId, vehicle) =>
      `Request to reclassify standalone ${mode} entry #${entryId} (${vehicle}) as empty pass-through.`,
    reply: "Rejected. Load manifest shows partial palletized cargo onboard.",
  },
];

function buildFactoryTicketSpecs<
  T extends { id: number; vehicle_number: string; creator_id?: number },
>(opts: {
  mode: "automatic" | "manual";
  entries: EntryGroup<T>;
  factoryUserIds: number[];
  templates: TicketTemplate[];
  factoryLabel: string;
}): TicketSpec[] {
  const { mode, entries, factoryUserIds, templates, factoryLabel } = opts;

  return templates.map((tpl, idx) => {
    const bucketEntries =
      tpl.bucket === "pairedIn"
        ? entries.pairedInEntries
        : tpl.bucket === "pairedOut"
          ? entries.pairedOutEntries
          : entries.standaloneEntries;

    const entry = bucketEntries[tpl.entryIndex];
    if (!entry) {
      throw new Error(
        `Missing ${factoryLabel} ${mode} ${tpl.bucket} entry at index ${tpl.entryIndex} for ticket seeding.`,
      );
    }

    const creatorId = pickTicketCreator(
      factoryUserIds,
      mode === "manual" ? entry.creator_id : undefined,
      idx,
    );

    if (mode === "manual" && creatorId === entry.creator_id) {
      throw new Error(
        `Manual ticket creator (${creatorId}) must differ from entry #${entry.id} creator (${entry.creator_id}).`,
      );
    }

    const createdAt = daysAgo(tpl.daysBack, tpl.createdMinutesOffset);
    const updatedAt =
      tpl.status === "pending"
        ? createdAt
        : daysAgo(tpl.daysBack, Math.max(0, tpl.createdMinutesOffset - tpl.replyDelayMinutes));

    return {
      concern: tpl.buildConcern(mode, entry.id, entry.vehicle_number),
      reply: tpl.reply,
      status: tpl.status,
      entry_id: entry.id,
      creator_id: creatorId,
      created_at: createdAt,
      updated_at: updatedAt,
    };
  });
}

export async function seedTickets({
  ctx,
  automatic,
  manual,
}: {
  ctx: SeedContext;
  automatic: EntryGroup<SeededAutomaticEntry>;
  manual: EntryGroup<SeededManualEntry>;
}): Promise<void> {
  console.log(
    "\n🎫 [6/6] Seeding Automatic & Manual Support Tickets across both factories & all statuses...",
  );

  const factory1UserIds = [
    getRequiredUserId(ctx.userMap, "admin1"),
    getRequiredUserId(ctx.userMap, "manager1"),
    getRequiredUserId(ctx.userMap, "operator1"),
    getRequiredUserId(ctx.userMap, "operator2"),
    getRequiredUserId(ctx.userMap, "base1"),
  ];

  const factory2UserIds = [
    getRequiredUserId(ctx.userMap, "admin2"),
    getRequiredUserId(ctx.userMap, "manager2"),
    getRequiredUserId(ctx.userMap, "operatorApex1"),
    getRequiredUserId(ctx.userMap, "base2"),
  ];

  const factory1Auto = partitionByFactory(automatic, ctx.primaryCenterIds);
  const factory2Auto = partitionByFactory(automatic, ctx.secondaryCenterIds);
  const factory1Manual = partitionByFactory(manual, ctx.primaryCenterIds);
  const factory2Manual = partitionByFactory(manual, ctx.secondaryCenterIds);

  const autoTicketSpecs: TicketSpec[] = [
    ...buildFactoryTicketSpecs({
      mode: "automatic",
      entries: factory1Auto,
      factoryUserIds: factory1UserIds,
      templates: FACTORY_1_TEMPLATES,
      factoryLabel: "Factory 1",
    }),
    ...buildFactoryTicketSpecs({
      mode: "automatic",
      entries: factory2Auto,
      factoryUserIds: factory2UserIds,
      templates: FACTORY_2_TEMPLATES,
      factoryLabel: "Factory 2",
    }),
  ];

  const manualTicketSpecs: TicketSpec[] = [
    ...buildFactoryTicketSpecs({
      mode: "manual",
      entries: factory1Manual,
      factoryUserIds: factory1UserIds,
      templates: FACTORY_1_TEMPLATES,
      factoryLabel: "Factory 1",
    }),
    ...buildFactoryTicketSpecs({
      mode: "manual",
      entries: factory2Manual,
      factoryUserIds: factory2UserIds,
      templates: FACTORY_2_TEMPLATES,
      factoryLabel: "Factory 2",
    }),
  ];

  const [autoRes, manualRes] = await Promise.all([
    supabase
      .from("automatic_tickets")
      .insert(autoTicketSpecs)
      .select("id, status, entry_id, creator_id"),
    supabase
      .from("manual_tickets")
      .insert(manualTicketSpecs)
      .select("id, status, entry_id, creator_id"),
  ]);

  if (autoRes.error || !autoRes.data) {
    throw new Error(`Failed to seed automatic_tickets: ${autoRes.error?.message}`);
  }
  if (manualRes.error || !manualRes.data) {
    throw new Error(`Failed to seed manual_tickets: ${manualRes.error?.message}`);
  }

  console.log(
    `  ✓ Seeded ${autoRes.data.length} automatic_tickets and ${manualRes.data.length} manual_tickets across Factory 1 & Factory 2 (approved, pending, rejected).`,
  );
}
