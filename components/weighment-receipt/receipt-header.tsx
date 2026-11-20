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
          <span className="inline-flex items-center gap-1 font-mono text-3xs font-semibold px-2 py-0.5 rounded-none bg-[#66684f]/15 text-[#66684f] uppercase tracking-wider">
            &bull; Material In
          </span>
        );
      case "out":
        return (
          <span className="inline-flex items-center gap-1 font-mono text-3xs font-semibold px-2 py-0.5 rounded-none bg-zinc-900 text-white uppercase tracking-wider">
            &bull; Material Out
          </span>
        );
      case "unassigned":
        return (
          <span className="inline-flex items-center gap-1 font-mono text-3xs font-semibold px-2 py-0.5 rounded-none bg-zinc-100 text-zinc-700 uppercase tracking-wider">
            &bull; Unassigned
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 font-mono text-3xs font-semibold px-2 py-0.5 rounded-none bg-amber-50 text-amber-800 uppercase tracking-wider">
            &bull; Pending
          </span>
        );
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-200/80 pb-1.5">
      {/* Factory Branding (Zero Truncation, Mesto Automations Header) */}
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Mesto Logo"
          crossOrigin="anonymous"
          className="size-8 object-contain shrink-0"
        />
        <div className="flex flex-col min-w-0">
          <span
            className="font-heading text-lg sm:text-xl font-semibold tracking-tight text-zinc-950 uppercase whitespace-normal leading-tight"
            style={{ fontFamily: "var(--font-heading), var(--font-sans), sans-serif" }}
          >
            Mesto Automations
          </span>
          <span
            className="font-heading text-xs font-semibold uppercase tracking-wider text-zinc-500 whitespace-normal leading-snug"
            style={{ fontFamily: "var(--font-heading), var(--font-sans), sans-serif" }}
          >
            {factoryName ?? "Mesto Facility"}
          </span>
        </div>
      </div>

      {/* Slip Metadata & Status Badges */}
      <div className="flex flex-col items-end text-right shrink-0 gap-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-zinc-950 tabular-nums">
            SLIP #{weighment.id}
          </span>
          <span className="text-zinc-300 font-mono">&bull;</span>
          <span className="text-3xs font-mono text-zinc-500 tabular-nums">
            {formatDateTime(new Date().toISOString())}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {getDirectionBadge()}
          <span className="inline-flex items-center font-mono text-3xs font-semibold px-2 py-0.5 rounded-none bg-zinc-100 text-zinc-800 uppercase tracking-wider">
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
    <div className="flex items-center justify-between border-b border-zinc-200/80 pb-1.5">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Mesto Logo"
          crossOrigin="anonymous"
          className="size-6 object-contain shrink-0"
        />
        <div className="flex items-baseline gap-2 min-w-0">
          <span
            className="font-heading text-xs font-semibold tracking-tight text-zinc-950 uppercase whitespace-normal"
            style={{ fontFamily: "var(--font-heading), var(--font-sans), sans-serif" }}
          >
            Mesto Automations
          </span>
          <span
            className="font-heading text-3xs font-semibold tracking-wider text-zinc-500 uppercase whitespace-normal"
            style={{ fontFamily: "var(--font-heading), var(--font-sans), sans-serif" }}
          >
            {factoryName ?? "Mesto Facility"}
          </span>
          <span className="text-3xs font-medium text-zinc-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <span>&bull;</span>
            <span>Transit Photos (Cont.)</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-right shrink-0">
        <span className="font-mono text-3xs font-semibold text-zinc-700 uppercase">
          {modeLabel}
        </span>
        <span className="font-mono text-3xs font-semibold text-zinc-900 tabular-nums">
          SLIP #{weighment.id}
        </span>
        <span className="font-mono text-3xs font-semibold text-zinc-600 bg-zinc-100 px-1 py-0.5 rounded-none">
          {weighment.vehicle_number}
        </span>
      </div>
    </div>
  );
}
