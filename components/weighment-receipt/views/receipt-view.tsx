import * as React from "react";
import { WeighmentReceiptHeader, WeighmentReceiptContinuationHeader } from "../sections/header";
import { ReceiptTransitDetails } from "../sections/transit-details";
import { WeighmentReceiptWeights } from "../sections/weights";
import { ReceiptPhotos, type ReceiptPhotoItem } from "../sections/photos";
import type { Factory } from "@/app/settings/types";
import type { Weighment } from "@/app/weighments/types";

export interface CommonReceiptLayoutProps {
  weighment: {
    id: number;
    vehicle_number: string;
    in_images: string[];
    out_images: string[];
    in_time: string;
    out_time: string;
    in_center_id: number;
    in_center_name: string;
    out_center_id: number;
    out_center_name: string;
  };
  factory: Factory;
  header: React.ReactNode;
  continuationHeader: React.ReactNode;
  weights: React.ReactNode;
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

export const CommonReceiptLayout = React.forwardRef<HTMLDivElement, CommonReceiptLayoutProps>(
  function CommonReceiptLayout({ weighment, factory, header, continuationHeader, weights }, ref) {
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
              className="receipt-page bg-white text-[#1f241d] rounded-none border border-[#e2dccb] p-5 flex flex-col gap-2 font-sans text-xs relative box-border w-[794px] h-[1123px] min-h-[1123px] max-h-[1123px]"
            >
              {isFirstPage ? (
                <>
                  {header}
                  <ReceiptTransitDetails weighment={weighment} />
                  {weights}
                  <ReceiptPhotos
                    photos={pagePhotos}
                    imagesPerRow={factory.receipt_images_per_row}
                    totalPhotosCount={allPhotos.length}
                    startIndex={currentStartIndex}
                  />
                </>
              ) : (
                <>
                  {continuationHeader}
                  <ReceiptPhotos
                    photos={pagePhotos}
                    imagesPerRow={factory.receipt_images_per_row}
                    totalPhotosCount={allPhotos.length}
                    startIndex={currentStartIndex}
                  />
                </>
              )}

              <div className="mt-auto pt-2 border-t border-[#e2dccb] flex items-center justify-between gap-3 text-3xs text-[#5f6558]">
                <span className="font-heading font-semibold text-[#5f6558]">
                  Official Scale Slip &bull; Mesto Industrial Automations
                </span>
                <div className="flex items-center gap-1 font-mono tabular-nums text-[#5f6558]">
                  <span>Page</span>
                  <strong className="text-[#1f241d] font-bold">{pageIdx + 1}</strong>
                  <span>of</span>
                  <strong className="text-[#1f241d] font-bold">{totalPages}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  },
);

export interface WeighmentReceiptViewProps {
  weighment: Weighment;
  factory: Factory;
}

export const WeighmentReceiptView = React.forwardRef<HTMLDivElement, WeighmentReceiptViewProps>(
  function WeighmentReceiptView({ weighment, factory }, ref) {
    return (
      <CommonReceiptLayout
        ref={ref}
        weighment={weighment}
        factory={factory}
        header={
          <WeighmentReceiptHeader id={weighment.id} type={weighment.type} factory={factory} />
        }
        continuationHeader={
          <WeighmentReceiptContinuationHeader
            id={weighment.id}
            vehicleNumber={weighment.vehicle_number}
            factory={factory}
          />
        }
        weights={<WeighmentReceiptWeights weighment={weighment} />}
      />
    );
  },
);
