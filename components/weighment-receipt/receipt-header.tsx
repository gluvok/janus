import * as React from "react";
import { formatDateTime } from "@/lib/utils";
import type { Weighment } from "@/app/weighments/types";

interface ReceiptHeaderProps {
  weighment: Weighment;
  factoryName?: string;
}

export function ReceiptHeader({ weighment, factoryName }: ReceiptHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-zinc-200 pb-2.5">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Mesto Logo"
          crossOrigin="anonymous"
          className="size-11 rounded-md object-contain border border-zinc-200 p-0.5 bg-zinc-50 shrink-0"
        />
        <div className="flex flex-col">
          <span className="font-heading text-lg sm:text-xl font-black tracking-tight text-zinc-950 uppercase leading-tight">
            {factoryName ?? "Mesto Facility"}
          </span>
          <span className="text-3xs font-medium text-zinc-500 uppercase tracking-wider">
            Mesto Automations Platform • Weighbridge Receipt
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end text-right shrink-0">
        <span className="font-mono text-xs sm:text-sm font-bold text-zinc-950">
          RECEIPT #{weighment.id}
        </span>
        <span className="text-3xs text-zinc-500 mt-0.5">
          Date: {formatDateTime(new Date().toISOString())}
        </span>
      </div>
    </div>
  );
}

export function ReceiptContinuationHeader({ weighment, factoryName }: ReceiptHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Mesto Logo"
          crossOrigin="anonymous"
          className="size-6 rounded object-contain border border-zinc-200 p-0.5 bg-zinc-50 shrink-0"
        />
        <span className="font-heading text-xs font-black tracking-tight text-zinc-950 uppercase">
          {factoryName}
        </span>
        <span className="text-3xs text-zinc-500">• Transit Photos (Continued)</span>
      </div>
      <div className="flex items-center gap-2 text-right">
        <span className="font-mono text-3xs font-bold text-zinc-900">RECEIPT #{weighment.id}</span>
        <span className="font-mono text-3xs text-zinc-500">({weighment.vehicle_number})</span>
      </div>
    </div>
  );
}

export function ReceiptContinuationHeader({ weighment, factoryName }: ReceiptHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Mesto Logo"
          crossOrigin="anonymous"
          className="size-6 rounded object-contain border border-zinc-200 p-0.5 bg-zinc-50 shrink-0"
        />
        <span className="font-heading text-xs font-black tracking-tight text-zinc-950 uppercase">
          {factoryName ?? "Mesto Facility"}
        </span>
        <span className="text-3xs text-zinc-500">• Transit Photos (Continued)</span>
      </div>
      <div className="flex items-center gap-2 text-right">
        <span className="font-mono text-3xs font-bold text-zinc-900">
          RECEIPT #{weighment.id}
        </span>
        <span className="font-mono text-3xs text-zinc-500">({weighment.vehicle_number})</span>
      </div>
    </div>
  );
}
