import * as React from "react";
import { AutomaticReceiptHeader, AutomaticReceiptContinuationHeader } from "./receipt-header";
import { ReceiptTransitDetails } from "./receipt-transit-details";
import { AutomaticReceiptWeights } from "./receipt-weights";
import { ReceiptPhotos, type ReceiptPhotoItem } from "./receipt-photos";
import type { Factory } from "@/app/settings/types";
import type { CompletedAutomaticWeighment } from "@/app/weighments/types";

export interface AutomaticWeighmentReceiptViewProps {
  weighment: CompletedAutomaticWeighment;
  factory: Factory;
}

function partitionPhotos(photos: ReceiptPhotoItem[], imagesPerRow: number): ReceiptPhotoItem[][] {
  if (photos.length === 0) return [[]];

  const pageLimit = imagesPerRow === 1 ? 2 : 6;
  const pages: ReceiptPhotoItem[][] = [];
  let remaining = [...photos];
  while (remaining.length > 0) {
    pages.push(remaining.slice(0, pageLimit));
    remaining = remaining.slice(pageLimit);
  }

  return pages;
}

export const AutomaticWeighmentReceiptView = React.forwardRef<
  HTMLDivElement,
  AutomaticWeighmentReceiptViewProps
>(function AutomaticWeighmentReceiptView({ weighment, factory }, ref) {
  const inPhotos: ReceiptPhotoItem[] = weighment.in_images.map((url) => ({
    url,
    direction: "in" as const,
  }));
  const outPhotos: ReceiptPhotoItem[] = weighment.out_images.map((url) => ({
    url,
    direction: "out" as const,
  }));
  const allPhotos: ReceiptPhotoItem[] = [...inPhotos, ...outPhotos].filter((p) => Boolean(p.url));

  const photoPages = partitionPhotos(allPhotos, factory.receipt_images_per_row);
  const totalPages = photoPages.length;

  let cumulativePhotoIndex = 0;

  return (
    <div id="printable-receipt-wrapper" ref={ref} className="flex flex-col gap-6">
      {photoPages.map((pagePhotos, pageIdx) => {
        const isFirstPage = pageIdx === 0;
        const currentStartIndex = cumulativePhotoIndex;
        cumulativePhotoIndex += pagePhotos.length;

        return (
          <div
            key={`receipt-page-${pageIdx + 1}`}
            className="receipt-page bg-white text-zinc-950 rounded-none border border-zinc-200/80 p-5 flex flex-col gap-2 font-sans text-xs relative box-border w-[794px] h-[1123px] min-h-[1123px] max-h-[1123px]"
          >
            {isFirstPage ? (
              <>
                <AutomaticReceiptHeader id={weighment.id} type={weighment.type} factory={factory} />
                <ReceiptTransitDetails weighment={weighment} />
                <AutomaticReceiptWeights weighment={weighment} />
                <ReceiptPhotos
                  photos={pagePhotos}
                  imagesPerRow={factory.receipt_images_per_row}
                  totalPhotosCount={allPhotos.length}
                  startIndex={currentStartIndex}
                />
              </>
            ) : (
              <>
                <AutomaticReceiptContinuationHeader
                  id={weighment.id}
                  vehicleNumber={weighment.vehicle_number}
                  factory={factory}
                />
                <ReceiptPhotos
                  photos={pagePhotos}
                  imagesPerRow={factory.receipt_images_per_row}
                  totalPhotosCount={allPhotos.length}
                  startIndex={currentStartIndex}
                />
              </>
            )}

            <div className="mt-auto pt-2 border-t border-zinc-200/80 flex items-center justify-between gap-3 text-3xs text-zinc-400">
              <span className="font-heading font-semibold text-zinc-500">
                Official Scale Slip &bull; Mesto Industrial Automations
              </span>
              <div className="flex items-center gap-1 font-mono tabular-nums text-zinc-600">
                <span>Page</span>
                <strong className="text-zinc-900 font-bold">{pageIdx + 1}</strong>
                <span>of</span>
                <strong className="text-zinc-900 font-bold">{totalPages}</strong>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});
