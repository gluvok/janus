import * as React from "react";
import type { Weighment, WeighmentMode } from "@/app/weighments/types";

interface ReceiptWeightsProps {
  weighment: Weighment;
  mode: WeighmentMode;
}

function WeightMetricCard({
  label,
  value,
  subtitle,
  isFirst = false,
}: {
  label: string;
  value: number | null;
  subtitle: string;
  isFirst?: boolean;
}) {
  return (
    <div
      className={`col-span-12 sm:col-span-4 flex flex-col gap-1 min-w-0 ${
        isFirst ? "sm:pr-4" : "sm:px-4"
      }`}
    >
      <span className="font-heading text-3xs uppercase tracking-widest text-zinc-400 font-bold">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-base sm:text-lg font-bold text-zinc-950 tabular-nums">
          {value !== null ? value.toLocaleString() : "—"}
        </span>
        <span className="text-3xs font-semibold text-zinc-400">kg</span>
      </div>
      <span className="text-3xs font-medium text-zinc-500">{subtitle}</span>
    </div>
  );
}

export function ReceiptWeights({ weighment, mode }: ReceiptWeightsProps) {
  const isManual = mode === "manual";
  const hasOperators = isManual && Boolean(weighment.in_creator || weighment.out_creator);

  // Gross is max(in_weight, out_weight), Tare is min(in_weight, out_weight)
  const isGrossIn = weighment.out_weight === null || weighment.in_weight >= weighment.out_weight;

  const grossSourceLabel = isGrossIn ? "In Weight" : "Out Weight";
  const tareSourceLabel = isGrossIn ? "Out Weight" : "In Weight";

  return (
    <div className="py-1.5 border-b border-zinc-200/80 rounded-none bg-white flex flex-col gap-1.5">
      {/* 3-Column Open Balance Bar */}
      <div className="grid grid-cols-12 gap-3 sm:gap-0 sm:divide-x divide-zinc-200/60 items-start">
        {/* Gross Weight */}
        <WeightMetricCard
          label="Gross Weight"
          value={weighment.gross}
          subtitle={grossSourceLabel}
          isFirst
        />

        {/* Tare Weight */}
        <WeightMetricCard
          label="Tare Weight"
          value={weighment.tare}
          subtitle={weighment.tare !== null ? tareSourceLabel : "Pending Scale"}
        />

        {/* Net Weight (Hero Value in Matcha) */}
        <div className="col-span-12 sm:col-span-4 sm:pl-4 flex flex-col gap-1 min-w-0">
          <span className="font-heading text-3xs uppercase tracking-widest text-[#66684f] font-black">
            Net Weight (Gross - Tare)
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-xl sm:text-2xl font-black text-[#66684f] tabular-nums tracking-tight">
              {weighment.net !== null ? weighment.net.toLocaleString() : "—"}
            </span>
            <span className="text-xs font-bold text-[#66684f]/80">kg</span>
          </div>
          <span className="text-3xs font-semibold text-[#66684f]/80">Certified Net Payload</span>
        </div>
      </div>

      {/* Discrete Operator Audit Line (Manual Scale) */}
      {hasOperators && (
        <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-3xs text-zinc-500">
          <span className="font-heading font-semibold uppercase tracking-wider text-zinc-400">
            Scale Operators:
          </span>
          <div className="flex items-center gap-3">
            {weighment.in_creator && (
              <span>
                Scale In:{" "}
                <strong className="font-bold text-zinc-900">{weighment.in_creator.name}</strong>
              </span>
            )}
            {weighment.out_creator && (
              <span>
                Scale Out:{" "}
                <strong className="font-bold text-zinc-900">{weighment.out_creator.name}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
