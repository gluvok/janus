import * as React from "react";
import { formatDateTime } from "@/lib/utils";
import type { Weighment } from "@/app/weighments/types";

interface ReceiptHeaderProps {
  weighment: Weighment;
  factoryName?: string;
}

export function ReceiptHeader({ weighment, factoryName }: ReceiptHeaderProps) {
  const isManual = Boolean(weighment.in_creator || weighment.out_creator);
  const modeLabel = isManual ? "Manual" : "Auto";

  const getDirectionBadge = () => {
    switch (weighment.type) {
      case "in":
        return (
          <span className="inline-flex items-center gap-1 font-mono text-3xs font-bold px-2 py-0.5 rounded border border-[#66684f]/30 bg-[#66684f]/10 text-[#66684f] uppercase tracking-wide">
            ● Material In
          </span>
        );
      case "out":
        return (
          <span className="inline-flex items-center gap-1 font-mono text-3xs font-bold px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-white uppercase tracking-wide">
            ● Material Out
          </span>
        );
      case "unassigned":
        return (
          <span className="inline-flex items-center gap-1 font-mono text-3xs font-bold px-2 py-0.5 rounded border border-zinc-300 bg-zinc-100 text-zinc-700 uppercase tracking-wide">
            ○ Unassigned
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 font-mono text-3xs font-bold px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800 uppercase tracking-wide">
            ⏳ Pending
          </span>
        );
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-200/90 pb-3">
      {/* Factory Branding */}
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Mesto Logo"
          crossOrigin="anonymous"
          className="size-11 rounded-md object-contain border border-[#66684f]/25 p-0.5 bg-[#66684f]/5 shrink-0"
        />
        <span className="font-heading text-xl font-black tracking-tight text-zinc-950 uppercase leading-tight">
          {factoryName ?? "Mesto Facility"}
        </span>
      </div>

      {/* Slip Metadata & Status Badges (Material In & Auto) */}
      <div className="flex flex-col items-end text-right shrink-0 gap-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-3xs font-bold text-zinc-400 uppercase tracking-wider">
              Slip No.
            </span>
            <span className="font-mono text-sm font-black text-zinc-950 tabular-nums">
              #{weighment.id}
            </span>
          </div>
          <span className="text-zinc-300">•</span>
          <span className="text-3xs font-mono text-zinc-500 tabular-nums">
            {formatDateTime(new Date().toISOString())}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mt-0.5">
          {getDirectionBadge()}
          <span className="inline-flex items-center font-mono text-3xs font-bold px-2 py-0.5 rounded border border-zinc-300 bg-zinc-100 text-zinc-800 uppercase tracking-wide">
            {modeLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ReceiptContinuationHeader({ weighment, factoryName }: ReceiptHeaderProps) {
  const isManual = Boolean(weighment.in_creator || weighment.out_creator);
  const modeLabel = isManual ? "Manual" : "Auto";

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
        <span className="font-mono text-3xs font-bold text-zinc-700 uppercase">{modeLabel}</span>
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
