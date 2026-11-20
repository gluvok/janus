import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight02Icon,
  Building02Icon,
  Building03Icon,
  TruckIcon,
} from "@hugeicons/core-free-icons";
import { formatDateTime } from "@/lib/utils";
import type { Weighment } from "@/app/weighments/types";

interface ReceiptTransitDetailsProps {
  weighment: Weighment;
}

export function ReceiptTransitDetails({ weighment }: ReceiptTransitDetailsProps) {
  return (
    <div className="border border-zinc-200/90 rounded-md px-3 py-2 bg-zinc-50/60 text-2xs">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Vehicle Plate Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-zinc-300 bg-white">
            <HugeiconsIcon icon={TruckIcon} className="size-3.5 text-[#66684f] shrink-0" />
            <span className="font-mono text-xs font-black text-zinc-950 tracking-wider">
              {weighment.vehicle_number}
            </span>
          </div>
        </div>

        {/* Right: Transit Scale Decks & Timestamps */}
        <div className="flex items-center justify-end gap-3 text-3xs min-w-0">
          {/* In Scale Deck & Timestamp */}
          <div className="flex items-center gap-1.5 min-w-0">
            <HugeiconsIcon icon={Building02Icon} className="size-3.5 text-zinc-500 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-zinc-900 truncate">
                [#{weighment.in_center.id}] {weighment.in_center.name}
              </span>
              <span className="font-mono text-zinc-500 tabular-nums">
                {formatDateTime(weighment.in_time)}
              </span>
            </div>
          </div>

          {/* Flow Arrow */}
          <div className="px-1 text-zinc-400 shrink-0">
            <HugeiconsIcon icon={ArrowRight02Icon} className="size-3.5 text-zinc-500" />
          </div>

          {/* Out Scale Deck & Timestamp */}
          <div className="flex items-center gap-1.5 min-w-0 text-right">
            <div className="flex flex-col min-w-0 items-end">
              <span className="font-bold text-zinc-900 truncate">
                {weighment.out_center
                  ? `[#${weighment.out_center.id}] ${weighment.out_center.name}`
                  : "—"}
              </span>
              <span className="font-mono text-zinc-500 tabular-nums">
                {formatDateTime(weighment.out_time)}
              </span>
            </div>
            <HugeiconsIcon icon={Building03Icon} className="size-3.5 text-zinc-500 shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}
