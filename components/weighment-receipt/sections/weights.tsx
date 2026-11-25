import * as React from "react";

interface WeightMetricCardProps {
  label: string;
  value: number;
  subtitle?: string;
  isFirst?: boolean;
}

function WeightMetricCard({ label, value, subtitle, isFirst = false }: WeightMetricCardProps) {
  return (
    <div
      className={`col-span-12 sm:col-span-4 flex flex-col gap-1 min-w-0 ${
        isFirst ? "sm:pr-4" : "sm:px-4"
      }`}
    >
      <span className="font-heading text-3xs text-[#5f6558] font-semibold">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-base sm:text-lg font-bold text-[#1f241d] tabular-nums">
          {value.toLocaleString()}
        </span>
        <span className="text-3xs font-semibold text-[#5f6558]">kg</span>
      </div>
      {subtitle && <span className="text-3xs font-medium text-[#5f6558]">{subtitle}</span>}
    </div>
  );
}

interface CommonWeightsData {
  gross: number;
  tare: number;
  net: number;
}

export function WeighmentReceiptWeights({ weighment }: { weighment: CommonWeightsData }) {
  return (
    <div className="py-1.5 border-b border-[#e2dccb] rounded-none bg-white flex flex-col gap-1.5">
      <div className="grid grid-cols-12 gap-3 sm:gap-0 sm:divide-x divide-[#e2dccb] items-start">
        <WeightMetricCard
          label="Gross Weight"
          value={weighment.gross}
          subtitle="Total platform weight"
          isFirst
        />
        <WeightMetricCard label="Tare Weight" value={weighment.tare} subtitle="Unladen weight" />
        <div className="col-span-12 sm:col-span-4 sm:pl-4 flex flex-col gap-1 min-w-0">
          <span className="font-heading text-3xs text-[#4a6741] font-bold">
            Net Weight (Gross - Tare)
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-xl sm:text-2xl font-black text-[#4a6741] tabular-nums tracking-tight">
              {weighment.net.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-[#4a6741]/85">kg</span>
          </div>
          <span className="text-3xs font-semibold text-[#4a6741]/85">Certified net payload</span>
        </div>
      </div>
    </div>
  );
}
