import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight02Icon,
  Building02Icon,
  Building03Icon,
  TruckIcon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { Weighment } from "@/app/weighments/types";

interface ReceiptTransitDetailsProps {
  weighment: Weighment;
}

export function ReceiptTransitDetails({ weighment }: ReceiptTransitDetailsProps) {
  const isManual = Boolean(weighment.in_creator || weighment.out_creator);
  const materialDirection =
    weighment.type === "in"
      ? "Material In"
      : weighment.type === "out"
        ? "Material Out"
        : weighment.type === "unassigned"
          ? "Material Unassigned"
          : "Pending";

  return (
    <div className="border border-zinc-200 rounded-md p-2 bg-zinc-50/70 text-2xs">
      <div className="grid grid-cols-12 gap-2 items-center">
        {/* Col 1: Vehicle Number & Mode (Automatic/Manual) */}
        <div className="col-span-12 sm:col-span-4 flex items-center gap-2 min-w-0">
          <div className="size-6 rounded bg-zinc-200/70 border border-zinc-300/80 flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={TruckIcon} className="size-3.5 text-zinc-700" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-mono text-xs font-bold text-zinc-950 truncate tracking-tight">
              {weighment.vehicle_number}
            </span>
            <span className="text-3xs font-medium text-zinc-500 uppercase tracking-wider">
              {isManual ? "Manual Weighment" : "Automatic Weighment"}
            </span>
          </div>
        </div>

        {/* Col 2: Material Direction (In/Out) */}
        <div className="col-span-12 sm:col-span-3 flex sm:justify-center items-center">
          <Badge
            variant="outline"
            className="font-mono text-3xs font-bold border-zinc-300 text-zinc-900 bg-white px-2 py-0.5 whitespace-nowrap"
          >
            {materialDirection}
          </Badge>
        </div>

        {/* Col 3: Transit Centers & Timestamps */}
        <div className="col-span-12 sm:col-span-5 flex items-center justify-between sm:justify-end gap-1.5 text-3xs">
          {/* Entry Center & Time */}
          <div className="flex items-center gap-1 min-w-0">
            <HugeiconsIcon icon={Building02Icon} className="size-3 text-zinc-500 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-zinc-900 truncate">
                [#{weighment.in_center.id}] {weighment.in_center.name}
              </span>
              <span className="font-mono text-zinc-500">{formatDateTime(weighment.in_time)}</span>
            </div>
          </div>

          {/* Transit Arrow */}
          <div className="px-1 text-zinc-400 shrink-0">
            <HugeiconsIcon icon={ArrowRight02Icon} className="size-3 text-zinc-500" />
          </div>

          {/* Exit Center & Time */}
          <div className="flex items-center gap-1 min-w-0 text-right">
            <div className="flex flex-col min-w-0 items-end">
              <span className="font-bold text-zinc-900 truncate">
                {weighment.out_center
                  ? `[#${weighment.out_center.id}] ${weighment.out_center.name}`
                  : "—"}
              </span>
              <span className="font-mono text-zinc-500">{formatDateTime(weighment.out_time)}</span>
            </div>
            <HugeiconsIcon icon={Building03Icon} className="size-3 text-zinc-500 shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}
