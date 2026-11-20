import * as React from "react";
import { formatDateTime } from "@/lib/utils";
import type { Weighment } from "@/app/weighments/types";

interface ReceiptTransitDetailsProps {
  weighment: Weighment;
}

export function ReceiptTransitDetails({ weighment }: ReceiptTransitDetailsProps) {
  return (
    <div className="border border-zinc-200/80 rounded-md p-3 bg-zinc-50/40">
      <div className="grid grid-cols-12 gap-3 sm:gap-0 sm:divide-x divide-zinc-200/80 items-center">
        {/* Col 1: Vehicle Identifier */}
        <div className="col-span-12 sm:col-span-4 sm:pr-4 flex flex-col gap-1 min-w-0">
          <span className="text-3xs uppercase tracking-widest text-zinc-400 font-bold">
            Vehicle No.
          </span>
          <span className="font-mono text-sm sm:text-base font-black text-zinc-950 tracking-wider truncate">
            {weighment.vehicle_number}
          </span>
        </div>

        {/* Col 2: Entry Scale & Timestamp */}
        <div className="col-span-12 sm:col-span-4 sm:px-4 flex flex-col gap-1 min-w-0">
          <span className="text-3xs uppercase tracking-widest text-zinc-400 font-bold">
            Entry Scale
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-zinc-900 truncate">
              [#{weighment.in_center.id}] {weighment.in_center.name}
            </span>
            <span className="font-mono text-3xs text-zinc-500 tabular-nums">
              {formatDateTime(weighment.in_time)}
            </span>
          </div>
        </div>

        {/* Col 3: Exit Scale & Timestamp */}
        <div className="col-span-12 sm:col-span-4 sm:pl-4 flex flex-col gap-1 min-w-0">
          <span className="text-3xs uppercase tracking-widest text-zinc-400 font-bold">
            Exit Scale
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-zinc-900 truncate">
              {weighment.out_center
                ? `[#${weighment.out_center.id}] ${weighment.out_center.name}`
                : "—"}
            </span>
            <span className="font-mono text-3xs text-zinc-500 tabular-nums">
              {weighment.out_time ? formatDateTime(weighment.out_time) : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
