import * as React from "react";
import { formatDateTime } from "@/lib/utils";
import type { Weighment } from "@/app/weighments/types";

interface ReceiptHeaderProps {
  weighment: Weighment;
  factoryName?: string;
}

export function ReceiptHeader({ weighment, factoryName }: ReceiptHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-200/90 pb-3">
      {/* Factory Branding & Platform Name */}
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Mesto Logo"
          crossOrigin="anonymous"
          className="size-11 rounded-md object-contain border border-[#66684f]/25 p-0.5 bg-[#66684f]/5 shrink-0"
        />
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-xl font-black tracking-tight text-zinc-950 uppercase leading-tight">
            {factoryName ?? "Mesto Facility"}
          </span>
          <span className="text-3xs font-semibold text-zinc-500 uppercase tracking-widest">
            Mesto Industrial Weighbridge • Certified Scale Slip
          </span>
        </div>
      </div>

      {/* Slip Metadata & Official Badge */}
      <div className="flex flex-col items-end text-right shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-3xs font-bold text-zinc-400 uppercase tracking-wider">
            Slip No.
          </span>
          <span className="font-mono text-sm font-black text-zinc-950 tabular-nums">
            #{weighment.id}
          </span>
        </div>
        <span className="text-3xs font-mono text-zinc-500 tabular-nums mt-0.5">
          {formatDateTime(new Date().toISOString())}
        </span>
        <div className="mt-1">
          <span className="inline-flex items-center font-mono text-3xs font-bold px-1.5 py-0.5 rounded border border-[#66684f]/30 bg-[#66684f]/10 text-[#66684f] uppercase tracking-wider">
            Official Record
          </span>
        </div>
      </div>
    </div>
  );
}

export function ReceiptContinuationHeader({ weighment, factoryName }: ReceiptHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-200/90 pb-2">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Mesto Logo"
          crossOrigin="anonymous"
          className="size-6 rounded object-contain border border-[#66684f]/25 p-0.5 bg-[#66684f]/5 shrink-0"
        />
        <span className="font-heading text-xs font-black tracking-tight text-zinc-950 uppercase">
          {factoryName ?? "Mesto Facility"}
        </span>
        <span className="text-3xs font-medium text-zinc-500 uppercase tracking-wider">
          • Transit Evidence Photos (Cont.)
        </span>
      </div>
      <div className="flex items-center gap-2 text-right">
        <span className="font-mono text-3xs font-bold text-zinc-900 tabular-nums">
          SLIP #{weighment.id}
        </span>
        <span className="font-mono text-3xs font-bold text-zinc-600 bg-zinc-100 px-1 py-0.5 rounded border border-zinc-200">
          {weighment.vehicle_number}
        </span>
      </div>
    </div>
  );
}
