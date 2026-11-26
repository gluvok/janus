import { formatDateTime } from "@/lib/utils";
import type { UserRole } from "@/app/users/types";
import type { WeighmentReceiptData, EntryReceiptData } from "../types";
import { ReceiptRolePill } from "./role-pill";

interface CreatorMeta {
  id?: number;
  name?: string;
  username?: string;
  role?: UserRole;
}

function CreatorAttribution({ creator }: { creator?: CreatorMeta }) {
  if (!creator || (creator.id === undefined && !creator.name && !creator.username)) {
    return null;
  }

  return (
    <div className="mt-1.5 pt-1.5 border-t border-[#dfddd2]/80 flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-baseline gap-1 min-w-0">
          {creator.id !== undefined && (
            <span className="font-mono text-3xs text-[#5f6558] shrink-0">#{creator.id}</span>
          )}
          {creator.name && (
            <span className="text-3xs font-semibold text-[#1f241d] truncate">{creator.name}</span>
          )}
        </div>
        {creator.role && <ReceiptRolePill role={creator.role} />}
      </div>
      {creator.username && (
        <span className="font-mono text-3xs text-[#5f6558] truncate">@{creator.username}</span>
      )}
    </div>
  );
}

function ScaleLocationColumn({
  label,
  accentClassName,
  time,
  centerId,
  centerName,
  creator,
  isLast = false,
}: {
  label: string;
  accentClassName: string;
  time: string;
  centerId: number;
  centerName: string;
  creator?: CreatorMeta;
  isLast?: boolean;
}) {
  return (
    <div
      className={`col-span-12 sm:col-span-4 flex flex-col gap-1 min-w-0 ${
        isLast ? "sm:pl-4" : "sm:px-4"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full shrink-0 ${accentClassName}`} />
        <span className="font-heading text-3xs text-[#5f6558] font-semibold">{label}</span>
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-mono text-xs font-bold text-[#1f241d] tabular-nums">
          {formatDateTime(time)}
        </span>
        <span className="text-3xs text-[#5f6558] truncate">
          #{centerId} {centerName}
        </span>
      </div>
      <CreatorAttribution creator={creator} />
    </div>
  );
}

export function ReceiptTransitDetails({ weighment }: { weighment: WeighmentReceiptData }) {
  const isManual = "in_creator_id" in weighment;

  const inCreator: CreatorMeta | undefined = isManual
    ? {
        id: weighment.in_creator_id,
        name: weighment.in_creator_name,
        username: weighment.in_creator_username,
        role: weighment.in_creator_role,
      }
    : undefined;

  const outCreator: CreatorMeta | undefined = isManual
    ? {
        id: weighment.out_creator_id,
        name: weighment.out_creator_name,
        username: weighment.out_creator_username,
        role: weighment.out_creator_role,
      }
    : undefined;

  return (
    <div className="rounded-lg border border-[#dfddd2] bg-[#fcfbf8] p-4">
      <div className="grid grid-cols-12 gap-3 sm:gap-0 sm:divide-x divide-[#dfddd2] items-start">
        <div className="col-span-12 sm:col-span-4 sm:pr-4 flex flex-col gap-1 min-w-0">
          <span className="font-heading text-3xs text-[#5f6558] font-semibold">Vehicle No.</span>
          <span className="font-mono text-base font-bold text-[#1f241d] tracking-wider truncate">
            {weighment.vehicle_number}
          </span>
          <span className="font-mono text-3xs text-[#5f6558] tabular-nums">
            Entries #{weighment.in_entry_id} &rarr; #{weighment.out_entry_id}
          </span>
        </div>

        <ScaleLocationColumn
          label="Scale In"
          accentClassName="bg-[#4a6741]"
          time={weighment.in_time}
          centerId={weighment.in_center_id}
          centerName={weighment.in_center_name}
          creator={inCreator}
        />

        <ScaleLocationColumn
          label="Scale Out"
          accentClassName="bg-[#9c4a2d]"
          time={weighment.out_time}
          centerId={weighment.out_center_id}
          centerName={weighment.out_center_name}
          creator={outCreator}
          isLast
        />
      </div>
    </div>
  );
}

export function EntryReceiptDetails({ entry }: { entry: EntryReceiptData }) {
  const isManual = "creator_id" in entry;
  const creator: CreatorMeta | undefined = isManual
    ? {
        id: entry.creator_id,
        name: entry.creator_name,
        username: entry.creator_username,
        role: entry.creator_role,
      }
    : undefined;

  return (
    <div className="rounded-lg border border-[#dfddd2] bg-[#fcfbf8] p-4">
      <div className="grid grid-cols-12 gap-3 sm:gap-0 sm:divide-x divide-[#dfddd2] items-start">
        <div className="col-span-12 sm:col-span-4 sm:pr-4 flex flex-col gap-1 min-w-0">
          <span className="font-heading text-3xs text-[#5f6558] font-semibold">Vehicle No.</span>
          <span className="font-mono text-base font-bold text-[#1f241d] tracking-wider truncate">
            {entry.vehicle_number}
          </span>
          <span className="font-mono text-3xs text-[#5f6558] tabular-nums">Entry #{entry.id}</span>
        </div>

        <div className="col-span-12 sm:col-span-4 sm:px-4 flex flex-col gap-1 min-w-0">
          <span className="font-heading text-3xs text-[#5f6558] font-semibold">Scale Center</span>
          <span className="text-xs font-semibold text-[#1f241d] truncate">
            <span className="font-mono text-[#5f6558]">#{entry.center_id}</span> {entry.center_name}
          </span>
          <span className="font-mono text-3xs text-[#5f6558] tabular-nums">
            {formatDateTime(entry.created_at)}
          </span>
        </div>

        <div className="col-span-12 sm:col-span-4 sm:pl-4 flex flex-col gap-1 min-w-0">
          <span className="font-heading text-3xs text-[#5f6558] font-semibold">
            {isManual ? "Recorded By" : "Capture Mode"}
          </span>
          {isManual && creator ? (
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <div className="flex items-baseline gap-1 min-w-0">
                  <span className="font-mono text-3xs text-[#5f6558] shrink-0">#{creator.id}</span>
                  <span className="text-xs font-semibold text-[#1f241d] truncate">
                    {creator.name}
                  </span>
                </div>
                {creator.role && <ReceiptRolePill role={creator.role} />}
              </div>
              <span className="font-mono text-3xs text-[#5f6558] truncate">
                @{creator.username}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-[#4a6741]">Automatic Scale Read</span>
              <span className="text-3xs text-[#5f6558]">Hardware telemetry capture</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
