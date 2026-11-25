import * as React from "react";
import { formatDateTime, cn } from "@/lib/utils";
import type { Factory } from "@/app/settings/types";
import type { WeighmentType } from "@/app/weighments/types";

const DIRECTION_CONFIG: Record<WeighmentType, { label: string; className: string }> = {
  in: { label: "Material In", className: "bg-[#4a6741]/12 text-[#4a6741]" },
  out: { label: "Material Out", className: "bg-[#1f241d] text-[#faf7f0]" },
  void: { label: "Void", className: "bg-[#f4efe4] text-[#2f352b]" },
};

export function ReceiptDirectionBadge({ type }: { type: WeighmentType }) {
  const config = DIRECTION_CONFIG[type] ?? DIRECTION_CONFIG.void;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-heading text-3xs font-semibold px-2 py-0.5 rounded-none",
        config.className,
      )}
    >
      &bull; {config.label}
    </span>
  );
}

export function ReceiptBranding({
  factoryName,
  compact = false,
}: {
  factoryName: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center min-w-0", compact ? "gap-2" : "gap-2.5")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Mesto Logo"
        crossOrigin="anonymous"
        className={cn("object-contain shrink-0", compact ? "size-6" : "size-8")}
      />
      <div className={cn("flex min-w-0", compact ? "items-baseline gap-2" : "flex-col")}>
        <span
          className={cn(
            "font-heading font-semibold tracking-tight text-[#1f241d] whitespace-normal",
            compact ? "text-xs" : "text-lg sm:text-xl leading-tight",
          )}
        >
          Mesto Automations
        </span>
        <span
          className={cn(
            "font-heading font-semibold text-[#5f6558] whitespace-normal",
            compact ? "text-3xs" : "text-xs leading-snug",
          )}
        >
          {factoryName}
        </span>
      </div>
    </div>
  );
}

interface CommonHeaderProps {
  id: number;
  type: WeighmentType;
  factory: Factory;
}

export function WeighmentReceiptHeader({ id, type, factory }: CommonHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#e2dccb] pb-1.5">
      <ReceiptBranding factoryName={factory.name} />

      <div className="flex flex-col items-end text-right shrink-0 gap-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-[#1f241d] tabular-nums">
            Slip #{id}
          </span>
          <span className="text-[#c9c2b0] font-mono">&bull;</span>
          <span className="text-3xs font-mono text-[#5f6558] tabular-nums">
            {formatDateTime(new Date().toISOString())}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <ReceiptDirectionBadge type={type} />
        </div>
      </div>
    </div>
  );
}

interface CommonContinuationHeaderProps {
  id: number;
  vehicleNumber: string;
  factory: Factory;
}

export function WeighmentReceiptContinuationHeader({
  id,
  vehicleNumber,
  factory,
}: CommonContinuationHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-[#e2dccb] pb-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <ReceiptBranding factoryName={factory.name} compact />
        <span className="text-3xs font-heading font-medium text-[#5f6558] shrink-0 flex items-center gap-1">
          <span>&bull;</span>
          <span>Transit Photos (Cont.)</span>
        </span>
      </div>
      <div className="flex items-center gap-2 text-right shrink-0">
        <span className="font-mono text-3xs font-semibold text-[#2f352b] tabular-nums">
          Slip #{id}
        </span>
        <span className="font-mono text-3xs font-semibold text-[#2f352b] bg-[#f4efe4] px-1 py-0.5 rounded-none">
          {vehicleNumber}
        </span>
      </div>
    </div>
  );
}
