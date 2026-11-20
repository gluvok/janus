import * as React from "react";
import type { Weighment } from "@/app/weighments/types";

interface ReceiptWeightsProps {
  weighment: Weighment;
}

export function ReceiptWeights({ weighment }: ReceiptWeightsProps) {
  const hasOperators = Boolean(weighment.in_creator || weighment.out_creator);

  return (
    <div className="border border-zinc-200/80 rounded-md p-3.5 bg-white flex flex-col gap-3">
      {/* 3-Column Open Balance Bar */}
      <div className="grid grid-cols-12 gap-3 sm:gap-0 sm:divide-x divide-zinc-200/80 items-start">
        {/* Gross Weight */}
        <div className="col-span-12 sm:col-span-4 sm:pr-4 flex flex-col gap-1 min-w-0">
          <span className="text-3xs uppercase tracking-widest text-zinc-400 font-bold">
            Gross Weight
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-base sm:text-lg font-bold text-zinc-950 tabular-nums">
              {weighment.gross.toLocaleString()}
            </span>
            <span className="text-3xs font-semibold text-zinc-400">kg</span>
          </div>
          <span className="text-3xs text-zinc-400">Entry Scale Total</span>
        </div>

        {/* Tare Weight */}
        <div className="col-span-12 sm:col-span-4 sm:px-4 flex flex-col gap-1 min-w-0">
          <span className="text-3xs uppercase tracking-widest text-zinc-400 font-bold">
            Tare Weight
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-base sm:text-lg font-bold text-zinc-950 tabular-nums">
              {weighment.tare !== null ? weighment.tare.toLocaleString() : "—"}
            </span>
            <span className="text-3xs font-semibold text-zinc-400">kg</span>
          </div>
          <span className="text-3xs text-zinc-400">Exit Vehicle Tare</span>
        </div>

        {/* Net Weight (Hero Value in Matcha) */}
        <div className="col-span-12 sm:col-span-4 sm:pl-4 flex flex-col gap-1 min-w-0">
          <span className="text-3xs uppercase tracking-widest text-[#66684f] font-black">
            Net Weight (Gross - Tare)
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-xl sm:text-2xl font-black text-[#66684f] tabular-nums tracking-tight">
              {weighment.net !== null ? weighment.net.toLocaleString() : "—"}
            </span>
            <span className="text-xs font-bold text-[#66684f]/80">kg</span>
          </div>
          <span className="text-3xs font-semibold text-[#66684f]/80">
            Certified Net Payload
          </span>
        </div>
      </div>

      {/* Discrete Operator Audit Line (Manual Scale) */}
      {hasOperators && (
        <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-3xs text-zinc-500">
          <span className="font-semibold uppercase tracking-wider text-zinc-400">
            Scale Operators:
          </span>
          <div className="flex items-center gap-3">
            {weighment.in_creator && (
              <span>
                Scale In: <strong className="font-bold text-zinc-900">{weighment.in_creator.name}</strong>
              </span>
            )}
            {weighment.out_creator && (
              <span>
                Scale Out: <strong className="font-bold text-zinc-900">{weighment.out_creator.name}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
