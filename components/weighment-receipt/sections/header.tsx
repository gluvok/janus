import * as React from "react";
import { formatDateTime, cn } from "@/lib/utils";
import type { Factory } from "@/app/settings/types";
import type { WeighmentType } from "@/app/weighments/types";
import type { EntityMode } from "@/stores/use-mode-store";

const DIRECTION_CONFIG: Record<WeighmentType, { label: string; className: string }> = {
  in: {
    label: "Material In",
    className: "bg-[#4a6741]/12 text-[#4a6741] border-[#4a6741]/25",
  },
  out: {
    label: "Material Out",
    className: "bg-[#9c4a2d]/12 text-[#9c4a2d] border-[#9c4a2d]/25",
  },
  void: {
    label: "Void",
    className: "bg-[#f2ede2] text-[#5f6558] border-[#e2dccb]",
  },
};

const MODE_CONFIG: Record<EntityMode, { label: string; className: string }> = {
  automatic: {
    label: "Automatic",
    className: "bg-[#4a6741]/12 text-[#4a6741] border-[#4a6741]/25",
  },
  manual: {
    label: "Manual",
    className: "bg-[#8c5e1a]/12 text-[#8c5e1a] border-[#8c5e1a]/25",
  },
};

export function ReceiptDirectionBadge({ type }: { type: WeighmentType }) {
  const config = DIRECTION_CONFIG[type] ?? DIRECTION_CONFIG.void;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-heading text-3xs font-semibold px-2 py-0.5 leading-none",
        config.className,
      )}
    >
      &bull; {config.label}
    </span>
  );
}

export function ReceiptModeBadge({ mode }: { mode: EntityMode }) {
  const config = MODE_CONFIG[mode];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-heading text-3xs font-semibold px-2 py-0.5 leading-none",
        config.className,
      )}
    >
      {config.label}
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
    <div className={cn("flex items-center min-w-0", compact ? "gap-2" : "gap-3")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Mesto Logo"
        crossOrigin="anonymous"
        className={cn("object-contain shrink-0", compact ? "size-6" : "size-9")}
      />
      <div className={cn("flex min-w-0", compact ? "items-baseline gap-2" : "flex-col gap-0.5")}>
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

interface BaseReceiptHeaderProps {
  factory: Factory;
  titleLabel: string;
  createdAt: string;
  badges: React.ReactNode;
}

function BaseReceiptHeader({ factory, titleLabel, createdAt, badges }: BaseReceiptHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#e2dccb] pb-3.5">
      <ReceiptBranding factoryName={factory.name} />

      <div className="flex flex-col items-end text-right shrink-0 gap-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-[#1f241d] tabular-nums">
            {titleLabel}
          </span>
          {badges}
        </div>
        <span className="text-3xs font-mono text-[#5f6558] tabular-nums">
          Recorded: {formatDateTime(createdAt)}
        </span>
      </div>
    </div>
  );
}

interface WeighmentReceiptHeaderProps {
  id: number;
  type: WeighmentType;
  createdAt: string;
  factory: Factory;
  mode?: EntityMode;
}

export function WeighmentReceiptHeader({
  id,
  type,
  createdAt,
  factory,
  mode,
}: WeighmentReceiptHeaderProps) {
  return (
    <BaseReceiptHeader
      factory={factory}
      titleLabel={`Slip #${id}`}
      createdAt={createdAt}
      badges={
        <div className="flex items-center gap-1.5">
          {mode && <ReceiptModeBadge mode={mode} />}
          <ReceiptDirectionBadge type={type} />
        </div>
      }
    />
  );
}

interface EntryReceiptHeaderProps {
  id: number;
  mode: EntityMode;
  createdAt: string;
  factory: Factory;
}

export function EntryReceiptHeader({ id, mode, createdAt, factory }: EntryReceiptHeaderProps) {
  return (
    <BaseReceiptHeader
      factory={factory}
      titleLabel={`Entry #${id}`}
      createdAt={createdAt}
      badges={<ReceiptModeBadge mode={mode} />}
    />
  );
}

interface CommonContinuationHeaderProps {
  id: number;
  idPrefix?: string;
  vehicleNumber: string;
  factory: Factory;
  subtitle?: string;
}

export function WeighmentReceiptContinuationHeader({
  id,
  idPrefix = "Slip",
  vehicleNumber,
  factory,
  subtitle = "Transit Photos (Cont.)",
}: CommonContinuationHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-[#e2dccb] pb-3">
      <div className="flex items-center gap-2 min-w-0">
        <ReceiptBranding factoryName={factory.name} compact />
        <span className="text-3xs font-heading font-medium text-[#5f6558] shrink-0 flex items-center gap-1.5">
          <span className="text-[#c9c2b0]">&bull;</span>
          <span>{subtitle}</span>
        </span>
      </div>
      <div className="flex items-center gap-2 text-right shrink-0">
        <span className="font-mono text-3xs font-semibold text-[#1f241d] tabular-nums">
          {idPrefix} #{id}
        </span>
        <span className="font-mono text-3xs font-semibold text-[#1f241d] bg-[#fdfbf6] border border-[#e2dccb] px-2 py-0.5 rounded-md">
          {vehicleNumber}
        </span>
      </div>
    </div>
  );
}
