import * as React from "react";
import { ReceiptHeader, ReceiptContinuationHeader } from "./receipt-header";
import { ReceiptTransitDetails } from "./receipt-transit-details";
import { ReceiptWeights } from "./receipt-weights";
import { ReceiptPhotos, type ReceiptPhotoItem } from "./receipt-photos";
import type { Weighment } from "@/app/weighments/types";

interface WeighmentReceiptViewProps {
  weighment: Weighment;
  factoryName?: string;
  imagesPerRow?: number;
}

function partitionPhotos(photos: ReceiptPhotoItem[], imagesPerRow: number): ReceiptPhotoItem[][] {
  if (photos.length === 0) return [[]];

  let page1Limit: number;
  let subsequentLimit: number;

  if (imagesPerRow === 1) {
    page1Limit = 1;
    subsequentLimit = 2;
  } else if (imagesPerRow === 2) {
    page1Limit = 4;
    subsequentLimit = 4;
  } else {
    page1Limit = 6;
    subsequentLimit = 6;
  }

  const pages: ReceiptPhotoItem[][] = [];
  const page1 = photos.slice(0, page1Limit);
  pages.push(page1);

  let remaining = photos.slice(page1Limit);
  while (remaining.length > 0) {
    pages.push(remaining.slice(0, subsequentLimit));
    remaining = remaining.slice(subsequentLimit);
  }

  return pages;
}

export const WeighmentReceiptView = React.forwardRef<HTMLDivElement, WeighmentReceiptViewProps>(
  function WeighmentReceiptView({ weighment, factoryName, imagesPerRow = 3 }, ref) {
    const inPhotos: ReceiptPhotoItem[] = (weighment.in_images ?? []).map((url) => ({
      url,
      direction: "in" as const,
    }));
    const outPhotos: ReceiptPhotoItem[] = (weighment.out_images ?? []).map((url) => ({
      url,
      direction: "out" as const,
    }));
    const allPhotos = [...inPhotos, ...outPhotos].filter((p) => Boolean(p.url));

    const photoPages = partitionPhotos(allPhotos, imagesPerRow);
    const totalPages = photoPages.length;

    return (
      <div id="printable-receipt-wrapper" ref={ref} className="flex flex-col gap-6">
        {photoPages.map((pagePhotos, pageIdx) => {
          const isFirstPage = pageIdx === 0;

          return (
            <div
              key={`receipt-page-${pageIdx + 1}`}
              className="receipt-page bg-white text-zinc-900 border border-zinc-200 p-6 flex flex-col gap-3 font-sans text-xs relative box-border"
              style={{ width: "794px", height: "1123px", minHeight: "1123px", maxHeight: "1123px" }}
            >
              {isFirstPage ? (
                <>
                  {/* Header Branding (Bigger Factory Name & Metadata) */}
                  <ReceiptHeader weighment={weighment} factoryName={factoryName} />

                  {/* Single-Row 3-Column Transit Details */}
                  <ReceiptTransitDetails weighment={weighment} />

                  {/* Weight Figures & Operators (Compact) */}
                  <ReceiptWeights weighment={weighment} />

                  {/* Page 1 Photos */}
                  <ReceiptPhotos
                    photos={pagePhotos}
                    imagesPerRow={imagesPerRow}
                    totalPhotosCount={allPhotos.length}
                  />
                </>
              ) : (
                <>
                  {/* Continuation Header */}
                  <ReceiptContinuationHeader weighment={weighment} factoryName={factoryName} />

                  {/* Page N Photos */}
                  <ReceiptPhotos
                    photos={pagePhotos}
                    imagesPerRow={imagesPerRow}
                    totalPhotosCount={allPhotos.length}
                  />
                </>
              )}

              {/* Footer Notice & Page Stamp */}
              <div className="mt-auto pt-2.5 border-t border-zinc-200 flex items-center justify-between gap-2 text-3xs text-zinc-500">
                <span className="font-medium">
                  Official Computer Generated Weighment Record • Mesto Automations Platform
                </span>
                <span className="font-mono">
                  Page {pageIdx + 1} of {totalPages}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  },
);
