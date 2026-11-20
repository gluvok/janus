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

  return (
    <div className="flex flex-col gap-2">
      {/* Vehicle & Mode Row (Compact) */}
      <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-md px-3 py-1.5 text-2xs">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={TruckIcon} className="size-3.5 text-zinc-600" />
          <span className="text-3xs uppercase font-medium text-zinc-500">Vehicle:</span>
          <span className="font-mono text-xs sm:text-sm font-bold text-zinc-950">
            {weighment.vehicle_number}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-3xs uppercase font-medium text-zinc-500">Weighment:</span>
          <span className="font-bold text-xs text-zinc-900">
            {isManual ? "Manual" : "Automatic"}
          </span>
        </div>
      </div>

      {/* Transit Centers & Timestamps in a SINGLE Compact Row */}
      <div className="border border-zinc-200 rounded-md p-2 sm:p-2.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <HugeiconsIcon icon={Building02Icon} className="size-3.5 text-zinc-500 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-xs text-zinc-900 truncate">
              [#{weighment.in_center.id}] {weighment.in_center.name}
            </span>
            <span className="font-mono text-3xs text-zinc-500">
              {formatDateTime(weighment.in_time)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center px-2 text-zinc-400 shrink-0">
          <HugeiconsIcon icon={ArrowRight02Icon} className="size-3.5 text-zinc-600" />
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0 sm:justify-end sm:text-right">
          <div className="flex flex-col min-w-0 sm:items-end">
            <span className="font-bold text-xs text-zinc-900 truncate">
              {weighment.out_center
                ? `[#${weighment.out_center.id}] ${weighment.out_center.name}`
                : "—"}
            </span>
            <span className="font-mono text-3xs text-zinc-500">
              {formatDateTime(weighment.out_time)}
            </span>
          </div>
          <HugeiconsIcon icon={Building03Icon} className="size-3.5 text-zinc-500 shrink-0" />
        </div>
      </div>
    </div>
  );
}
