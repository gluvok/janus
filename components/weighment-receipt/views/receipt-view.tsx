import * as React from "react";
import {
  EntryReceiptHeader,
  WeighmentReceiptHeader,
  WeighmentReceiptContinuationHeader,
} from "../sections/header";
import { ReceiptTransitDetails, EntryReceiptDetails } from "../sections/transit-details";
import { WeighmentReceiptWeights, EntryReceiptWeight } from "../sections/weights";
import { ReceiptPhotos, type ReceiptPhotoItem } from "../sections/photos";
import type { Factory } from "@/app/settings/types";
import type { EntityMode } from "@/stores/use-mode-store";
import type { WeighmentReceiptData, EntryReceiptData } from "../types";

export interface CommonReceiptLayoutProps {
  photos: ReceiptPhotoItem[];
  factory: Factory;
  header: React.ReactNode;
  continuationHeader: React.ReactNode;
  summarySections: React.ReactNode;
  photosHeading?: string;
  footerLabel?: string;
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
  function CommonReceiptLayout(
    {
      photos,
      factory,
      header,
      continuationHeader,
      summarySections,
      photosHeading = "Transit Evidence",
      footerLabel = "Official Scale Slip • Mesto Automations",
    },
    ref,
  ) {
    const photoPages = partitionPhotos(photos, factory.receipt_images_per_row);
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
              className="receipt-page bg-[#faf7f0] text-[#1f241d] border border-[#e2dccb] p-7 flex flex-col gap-4 font-sans text-xs relative box-border w-[794px] h-[1123px] min-h-[1123px] max-h-[1123px]"
            >
              {isFirstPage ? (
                <>
                  {header}
                  {summarySections}
                  <ReceiptPhotos
                    photos={pagePhotos}
                    imagesPerRow={factory.receipt_images_per_row}
                    totalPhotosCount={photos.length}
                    startIndex={currentStartIndex}
                    heading={photosHeading}
                  />
                </>
              ) : (
                <>
                  {continuationHeader}
                  <ReceiptPhotos
                    photos={pagePhotos}
                    imagesPerRow={factory.receipt_images_per_row}
                    totalPhotosCount={photos.length}
                    startIndex={currentStartIndex}
                    heading={photosHeading}
                  />
                </>
              )}

              <div className="mt-auto pt-3 border-t border-[#e2dccb] flex items-center justify-between gap-3 text-3xs text-[#5f6558]">
                <span className="font-heading font-semibold text-[#5f6558]">{footerLabel}</span>
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
  weighment: WeighmentReceiptData;
  factory: Factory;
  mode?: EntityMode;
}

export const WeighmentReceiptView = React.forwardRef<HTMLDivElement, WeighmentReceiptViewProps>(
  function WeighmentReceiptView({ weighment, factory, mode }, ref) {
    const resolvedMode: EntityMode =
      mode ?? ("in_creator_id" in weighment ? "manual" : "automatic");

    const allPhotos: ReceiptPhotoItem[] = [
      ...weighment.in_images.map((url) => ({ url, direction: "in" as const })),
      ...weighment.out_images.map((url) => ({ url, direction: "out" as const })),
    ].filter((p) => Boolean(p.url));

    return (
      <CommonReceiptLayout
        ref={ref}
        photos={allPhotos}
        factory={factory}
        header={
          <WeighmentReceiptHeader
            id={weighment.id}
            type={weighment.type}
            createdAt={weighment.created_at}
            factory={factory}
            mode={resolvedMode}
          />
        }
        continuationHeader={
          <WeighmentReceiptContinuationHeader
            id={weighment.id}
            idPrefix="Slip"
            vehicleNumber={weighment.vehicle_number}
            factory={factory}
            subtitle="Transit Photos (Cont.)"
          />
        }
        summarySections={
          <>
            <ReceiptTransitDetails weighment={weighment} />
            <WeighmentReceiptWeights weighment={weighment} />
          </>
        }
        photosHeading="Transit Evidence"
        footerLabel="Official Weighment Slip • Mesto Automations"
      />
    );
  },
);

export interface EntryReceiptViewProps {
  entry: EntryReceiptData;
  factory: Factory;
  mode?: EntityMode;
}

export const EntryReceiptView = React.forwardRef<HTMLDivElement, EntryReceiptViewProps>(
  function EntryReceiptView({ entry, factory, mode }, ref) {
    const resolvedMode: EntityMode = mode ?? ("creator_id" in entry ? "manual" : "automatic");

    const allPhotos: ReceiptPhotoItem[] = entry.images
      .filter((url) => Boolean(url))
      .map((url) => ({ url }));

    return (
      <CommonReceiptLayout
        ref={ref}
        photos={allPhotos}
        factory={factory}
        header={
          <EntryReceiptHeader
            id={entry.id}
            mode={resolvedMode}
            createdAt={entry.created_at}
            factory={factory}
          />
        }
        continuationHeader={
          <WeighmentReceiptContinuationHeader
            id={entry.id}
            idPrefix="Entry"
            vehicleNumber={entry.vehicle_number}
            factory={factory}
            subtitle="Capture Photos (Cont.)"
          />
        }
        summarySections={
          <>
            <EntryReceiptDetails entry={entry} />
            <EntryReceiptWeight weight={entry.weight} />
          </>
        }
        photosHeading="Scale Capture Evidence"
        footerLabel="Official Entry Slip • Mesto Automations"
      />
    );
  },
);
