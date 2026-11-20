import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { Weighment } from "@/app/weighments/types";

interface ReceiptHeaderProps {
  weighment: Weighment;
  factoryName?: string;
}

export function ReceiptHeader({ weighment, factoryName }: ReceiptHeaderProps) {
  const materialDirection =
    weighment.type === "in"
      ? "Material In"
      : weighment.type === "out"
        ? "Material Out"
        : weighment.type === "unassigned"
          ? "Material Unassigned"
          : "Pending";

  return (
    <div className="flex items-start justify-between gap-3 border-b border-zinc-200 pb-3">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Mesto Logo"
          crossOrigin="anonymous"
          className="size-11 rounded-md object-contain border border-zinc-100 p-0.5 bg-zinc-50 shrink-0"
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
        <span className="text-3xs text-zinc-400 mt-0.5">
          Generated: {formatDateTime(new Date().toISOString())}
        </span>
        <Badge
          variant="outline"
          className="mt-1 font-mono text-3xs font-bold border-zinc-300 text-zinc-900 bg-zinc-100 px-1.5 py-0"
        >
          {materialDirection}
        </Badge>
      </div>
    </div>
  );
}
