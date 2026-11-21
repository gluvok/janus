import * as React from "react";
import { formatDateTime, cn } from "@/lib/utils";
import type { Factory } from "@/app/settings/types";
import type {
  CompletedWeighment,
  CompletedWeighmentType,
  WeighmentMode,
} from "@/app/weighments/types";

interface ReceiptHeaderProps {
  weighment: CompletedWeighment;
  factory: Factory;
  mode: WeighmentMode;
}

const DIRECTION_CONFIG: Record<CompletedWeighmentType, { label: string; className: string }> = {
  in: { label: "Material In", className: "bg-[#66684f]/15 text-[#66684f]" },
  out: { label: "Material Out", className: "bg-zinc-900 text-white" },
  unassigned: { label: "Unassigned", className: "bg-zinc-100 text-zinc-700" },
};

export function ReceiptDirectionBadge({ type }: { type: CompletedWeighmentType }) {
  const config = DIRECTION_CONFIG[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-heading text-3xs font-semibold px-2 py-0.5 rounded-none uppercase tracking-wider",
        config.className,
      )}
    >
      &bull; {config.label}
    </span>
  );
}

interface BaseModeBadgeProps {
  label: string;
  className: string;
}

function BaseModeBadge({ label, className }: BaseModeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-heading text-3xs font-semibold rounded-none uppercase tracking-wider px-2 py-0.5",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function AutoModeBadge() {
  return <BaseModeBadge label="Auto" className="bg-sky-50 text-sky-800" />;
}

export function ManualModeBadge() {
  return <BaseModeBadge label="Manual" className="bg-amber-50 text-amber-900" />;
}

const MODE_BADGES: Record<WeighmentMode, React.ComponentType> = {
  automatic: AutoModeBadge,
  manual: ManualModeBadge,
};

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
            "font-heading font-semibold tracking-tight text-zinc-950 uppercase whitespace-normal",
            compact ? "text-xs" : "text-lg sm:text-xl leading-tight",
          )}
        >
          Mesto Automations
        </span>
        <span
          className={cn(
            "font-heading font-semibold uppercase tracking-wider text-zinc-500 whitespace-normal",
            compact ? "text-3xs" : "text-xs leading-snug",
          )}
        >
          {factoryName}
        </span>
      </div>
    </div>
  );
}

export function ReceiptHeader({ weighment, factory, mode }: ReceiptHeaderProps) {
  const ModeBadge = MODE_BADGES[mode];

  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-200/80 pb-1.5">
      <ReceiptBranding factoryName={factory.name} />

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
          <ReceiptDirectionBadge type={weighment.type} />
          <ModeBadge />
        </div>
      </div>
    </div>
  );
}

export function ReceiptContinuationHeader({ weighment, factory, mode }: ReceiptHeaderProps) {
  const ModeBadge = MODE_BADGES[mode];

  return (
    <div className="flex items-center justify-between border-b border-zinc-200/80 pb-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <ReceiptBranding factoryName={factory.name} compact />
        <span className="text-3xs font-heading font-medium text-zinc-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <span>&bull;</span>
          <span>Transit Photos (Cont.)</span>
        </span>
      </div>
      <div className="flex items-center gap-2 text-right shrink-0">
        <ModeBadge />
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
