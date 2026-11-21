import * as React from "react";
import { ReceiptHeader, ReceiptContinuationHeader } from "./receipt-header";
import { ReceiptTransitDetails } from "./receipt-transit-details";
import { ReceiptWeights } from "./receipt-weights";
import { ReceiptPhotos, type ReceiptPhotoItem } from "./receipt-photos";
import type { Weighment, WeighmentMode } from "@/app/weighments/types";

interface WeighmentReceiptViewProps {
  weighment: Weighment;
  factoryName?: string;
  imagesPerRow?: number;
  mode: WeighmentMode;
}

function partitionPhotos(photos: ReceiptPhotoItem[], imagesPerRow: number): ReceiptPhotoItem[][] {
  if (photos.length === 0) return [[]];

  // Option 1: 1 per row -> exactly 2 images per page (2x1 grid)
  // Option 2: 2 per row -> up to 3 rows (up to 6 images per page: 2x2 for 4, 3x2 for 6)
  const pageLimit = imagesPerRow === 1 ? 2 : 6;

  const pages: ReceiptPhotoItem[][] = [];
  let remaining = [...photos];
  while (remaining.length > 0) {
    pages.push(remaining.slice(0, pageLimit));
    remaining = remaining.slice(pageLimit);
  }

  return pages;
}

export const WeighmentReceiptView = React.forwardRef<HTMLDivElement, WeighmentReceiptViewProps>(
  function WeighmentReceiptView({ weighment, factoryName, imagesPerRow = 2, mode }, ref) {
    // Specifically extract in_images and out_images to ensure accurate weighment attribution
    const inPhotos: ReceiptPhotoItem[] = (weighment.in_images ?? []).map((url) => ({
      url,
      direction: "in" as const,
    }));
    const outPhotos: ReceiptPhotoItem[] = (weighment.out_images ?? []).map((url) => ({
      url,
      direction: "out" as const,
    }));
    const allPhotos: ReceiptPhotoItem[] = [...inPhotos, ...outPhotos].filter((p) => Boolean(p.url));

    // Fallback if in_images/out_images arrays are empty but weighment.images has URLs
    if (allPhotos.length === 0 && Array.isArray(weighment.images)) {
      for (const url of weighment.images) {
        if (url) {
          allPhotos.push({ url, direction: "in" });
        }
      }
    }

    const photoPages = partitionPhotos(allPhotos, imagesPerRow);
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
              className="receipt-page bg-white text-zinc-950 rounded-none border border-zinc-200/80 p-5 flex flex-col gap-2 font-sans text-xs relative box-border"
              style={{
                width: "794px",
                height: "1123px",
                minHeight: "1123px",
                maxHeight: "1123px",
              }}
            >
              {isFirstPage ? (
                <>
                  {/* Primary Header with High-Impact Branding, Material In/Out & Auto/Manual */}
                  <ReceiptHeader weighment={weighment} factoryName={factoryName} mode={mode} />

                  {/* Clean 3-Column Structured Transit Details */}
                  <ReceiptTransitDetails weighment={weighment} />

                  {/* Open 3-Column Balance Bar (Hero Matcha Net Weight) */}
                  <ReceiptWeights weighment={weighment} mode={mode} />

                  {/* Page 1 Transit Photos with Minimalist IN / OUT Badges */}
                  <ReceiptPhotos
                    photos={pagePhotos}
                    imagesPerRow={imagesPerRow}
                    totalPhotosCount={allPhotos.length}
                    startIndex={currentStartIndex}
                  />
                </>
              ) : (
                <>
                  {/* Clean Continuation Header */}
                  <ReceiptContinuationHeader
                    weighment={weighment}
                    factoryName={factoryName}
                    mode={mode}
                  />

                  {/* Page N Transit Photos with Minimalist IN / OUT Badges */}
                  <ReceiptPhotos
                    photos={pagePhotos}
                    imagesPerRow={imagesPerRow}
                    totalPhotosCount={allPhotos.length}
                    startIndex={currentStartIndex}
                  />
                </>
              )}

              {/* Minimalist Scale Slip Footer & Tabular Page Number */}
              <div className="mt-auto pt-2 border-t border-zinc-200/80 flex items-center justify-between gap-3 text-3xs text-zinc-400">
                <span className="font-heading font-semibold uppercase tracking-wider text-zinc-500">
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
  },
);
