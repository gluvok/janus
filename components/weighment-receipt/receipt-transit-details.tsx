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
  const isManual = Boolean(weighment.in_creator || weighment.out_creator);

  const getDirectionBadge = () => {
    switch (weighment.type) {
      case "in":
        return (
          <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2.5 py-1 rounded border border-[#66684f]/30 bg-[#66684f]/10 text-[#66684f] uppercase tracking-wide">
            ● Material In
          </span>
        );
      case "out":
        return (
          <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900 text-white uppercase tracking-wide">
            ● Material Out
          </span>
        );
      case "unassigned":
        return (
          <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2.5 py-1 rounded border border-zinc-300 bg-zinc-100 text-zinc-700 uppercase tracking-wide">
            ○ Unassigned
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2.5 py-1 rounded border border-amber-300 bg-amber-50 text-amber-800 uppercase tracking-wide">
            ⏳ Pending
          </span>
        );
    }
  };

  return (
    <div className="border border-zinc-200/90 rounded-md p-2.5 bg-zinc-50/60 text-2xs">
      <div className="grid grid-cols-12 gap-3 items-center">
        {/* Col 1: Vehicle Plate & Mode */}
        <div className="col-span-12 sm:col-span-4 flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-zinc-300 bg-white min-w-0">
            <HugeiconsIcon icon={TruckIcon} className="size-3.5 text-[#66684f] shrink-0" />
            <span className="font-mono text-xs font-black text-zinc-950 truncate tracking-wide">
              {weighment.vehicle_number}
            </span>
          </div>
          <span className="text-3xs font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap">
            {isManual ? "Manual Mode" : "Automatic Mode"}
          </span>
        </div>

        {/* Col 2: Material Direction Pill */}
        <div className="col-span-12 sm:col-span-3 flex sm:justify-center items-center">
          {getDirectionBadge()}
        </div>

        {/* Col 3: Transit Centers & Timestamps */}
        <div className="col-span-12 sm:col-span-5 flex items-center justify-between sm:justify-end gap-2 text-3xs">
          {/* In Center & Timestamp */}
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

          {/* Transit Flow Arrow */}
          <div className="px-1 text-zinc-400 shrink-0">
            <HugeiconsIcon icon={ArrowRight02Icon} className="size-3.5 text-zinc-500" />
          </div>

          {/* Out Center & Timestamp */}
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
