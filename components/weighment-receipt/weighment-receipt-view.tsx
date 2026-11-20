import * as React from "react";
import { ReceiptHeader } from "./receipt-header";
import { ReceiptTransitDetails } from "./receipt-transit-details";
import { ReceiptWeights } from "./receipt-weights";
import { ReceiptPhotos } from "./receipt-photos";
import type { Weighment } from "@/app/weighments/types";

interface WeighmentReceiptViewProps {
  weighment: Weighment;
  factoryName?: string;
  imagesPerRow?: number;
}

export const WeighmentReceiptView = React.forwardRef<HTMLDivElement, WeighmentReceiptViewProps>(
  function WeighmentReceiptView({ weighment, factoryName, imagesPerRow = 3 }, ref) {
    return (
      <div
        id="printable-receipt"
        ref={ref}
        className="w-full max-w-[800px] bg-white text-zinc-900 border border-zinc-200 rounded-lg p-4 sm:p-5 flex flex-col gap-3 shadow-xs font-sans text-xs"
      >
        {/* Header Branding (Bigger Factory Name + Material Direction) */}
        <ReceiptHeader weighment={weighment} factoryName={factoryName} />

        {/* Transit Route Details (Single compact row) */}
        <ReceiptTransitDetails weighment={weighment} />

        {/* Weight Figures & Operators (Compact) */}
        <ReceiptWeights weighment={weighment} />

        {/* Evidence Photos (Truck In / Truck Out) */}
        <ReceiptPhotos weighment={weighment} imagesPerRow={imagesPerRow} />

        {/* Footer Notice & Page Stamp */}
        <div className="mt-auto pt-2.5 border-t border-zinc-200 flex items-center justify-between gap-2 text-3xs text-zinc-400">
          <span className="font-medium text-zinc-500">
            Official Computer Generated Weighment Record • Mesto Automations Platform
          </span>
          <span className="font-mono text-zinc-500">Page 1 of 1</span>
        </div>
      </div>
    );
  },
);
