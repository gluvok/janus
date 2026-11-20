import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ContainerTruck01Icon,
  PackageOpenIcon,
  ScaleIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import type { Weighment } from "@/app/weighments/types";

interface ReceiptWeightsProps {
  weighment: Weighment;
}

export function ReceiptWeights({ weighment }: ReceiptWeightsProps) {
  const hasOperators = Boolean(weighment.in_creator || weighment.out_creator);

  return (
    <div className="flex flex-col gap-2">
      {/* Weight Readout Grid (Industrial Modern with Matcha Hero Card) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Gross Weight */}
        <div className="border border-zinc-200/90 rounded-md p-2.5 bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-3xs font-bold uppercase tracking-wider text-zinc-500">
              Gross Weight
            </span>
            <HugeiconsIcon icon={ContainerTruck01Icon} className="size-3.5 text-zinc-400" />
          </div>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className="font-mono text-base sm:text-lg font-bold text-zinc-950 tabular-nums">
              {weighment.gross.toLocaleString()}
            </span>
            <span className="text-3xs font-semibold text-zinc-500">kg</span>
          </div>
          <span className="text-3xs text-zinc-400 mt-0.5">Initial Entry Scale</span>
        </div>

        {/* Tare Weight */}
        <div className="border border-zinc-200/90 rounded-md p-2.5 bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-3xs font-bold uppercase tracking-wider text-zinc-500">
              Tare Weight
            </span>
            <HugeiconsIcon icon={PackageOpenIcon} className="size-3.5 text-zinc-400" />
          </div>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className="font-mono text-base sm:text-lg font-bold text-zinc-950 tabular-nums">
              {weighment.tare !== null ? weighment.tare.toLocaleString() : "—"}
            </span>
            <span className="text-3xs font-semibold text-zinc-500">kg</span>
          </div>
          <span className="text-3xs text-zinc-400 mt-0.5">Final Tare Scale</span>
        </div>

        {/* Net Weight (Hero Matcha Card) */}
        <div className="border border-[#52543d] rounded-md p-2.5 bg-[#66684f] text-white flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/90">
            <span className="text-3xs font-bold uppercase tracking-wider">Net Weight</span>
            <HugeiconsIcon icon={ScaleIcon} className="size-3.5 text-white/90" />
          </div>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className="font-mono text-base sm:text-lg font-black text-white tabular-nums">
              {weighment.net !== null ? weighment.net.toLocaleString() : "—"}
            </span>
            <span className="text-3xs font-semibold text-white/90">kg</span>
          </div>
          <span className="font-mono text-3xs font-bold text-white/80 uppercase tracking-wider mt-0.5">
            Formula: Net = Gross - Tare
          </span>
        </div>
      </div>

      {/* Operator Sign-off Row (Manual Weighment Audit) */}
      {hasOperators && (
        <div className="flex items-center justify-between gap-3 border border-zinc-200/90 rounded-md px-3 py-1.5 bg-zinc-50 text-2xs text-zinc-600">
          <div className="flex items-center gap-1.5">
            <HugeiconsIcon icon={UserIcon} className="size-3.5 text-[#66684f]" />
            <span className="text-3xs font-bold uppercase tracking-wider text-zinc-600">
              Certified Scale Operators:
            </span>
          </div>
          <div className="flex items-center gap-4 text-right text-3xs">
            {weighment.in_creator && (
              <span>
                Scale In:{" "}
                <strong className="font-bold text-zinc-950">{weighment.in_creator.name}</strong>
              </span>
            )}
            {weighment.out_creator && (
              <span>
                Scale Out:{" "}
                <strong className="font-bold text-zinc-950">{weighment.out_creator.name}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
