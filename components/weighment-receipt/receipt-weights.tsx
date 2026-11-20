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
      {/* Weight Figures Cards (Compact Minimalist) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Gross Weight */}
        <div className="border border-zinc-200 rounded-md p-2 sm:p-2.5 bg-white flex flex-col gap-0.5">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-3xs font-medium uppercase tracking-wider">Gross Weight</span>
            <HugeiconsIcon icon={ContainerTruck01Icon} className="size-3" />
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono text-sm sm:text-base font-bold text-zinc-900">
              {weighment.gross.toLocaleString()}
            </span>
            <span className="text-3xs text-zinc-500">kg</span>
          </div>
        </div>

        {/* Tare Weight */}
        <div className="border border-zinc-200 rounded-md p-2 sm:p-2.5 bg-white flex flex-col gap-0.5">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-3xs font-medium uppercase tracking-wider">Tare Weight</span>
            <HugeiconsIcon icon={PackageOpenIcon} className="size-3" />
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono text-sm sm:text-base font-bold text-zinc-900">
              {weighment.tare !== null ? weighment.tare.toLocaleString() : "—"}
            </span>
            <span className="text-3xs text-zinc-500">kg</span>
          </div>
        </div>

        {/* Net Weight */}
        <div className="border-2 border-zinc-900 rounded-md p-2 sm:p-2.5 bg-zinc-900 text-white flex flex-col gap-0.5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-300">
            <span className="text-3xs font-semibold uppercase tracking-wider">Net Weight</span>
            <HugeiconsIcon icon={ScaleIcon} className="size-3" />
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono text-sm sm:text-base font-black text-white">
              {weighment.net !== null ? weighment.net.toLocaleString() : "—"}
            </span>
            <span className="text-3xs text-zinc-300 font-medium">kg</span>
          </div>
        </div>
      </div>

      {/* Operator Sign-off (Manual Mode, Compact) */}
      {hasOperators && (
        <div className="flex items-center justify-between gap-3 border border-zinc-200 rounded-md px-3 py-1.5 bg-zinc-50 text-2xs text-zinc-600">
          <div className="flex items-center gap-1.5">
            <HugeiconsIcon icon={UserIcon} className="size-3 text-zinc-500" />
            <span className="text-3xs font-medium uppercase text-zinc-500">Operator Sign-Off:</span>
          </div>
          <div className="flex items-center gap-3 text-right text-3xs">
            {weighment.in_creator && (
              <span>
                In: <strong className="text-zinc-900">{weighment.in_creator.name}</strong>
              </span>
            )}
            {weighment.out_creator && (
              <span>
                Out: <strong className="text-zinc-900">{weighment.out_creator.name}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
