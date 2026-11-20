import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Camera01Icon } from "@hugeicons/core-free-icons";

export interface ReceiptPhotoItem {
  url: string;
  direction: "in" | "out";
}

interface ReceiptPhotosProps {
  photos: ReceiptPhotoItem[];
  imagesPerRow?: number;
  totalPhotosCount?: number;
}

export function ReceiptPhotos({ photos, imagesPerRow = 3, totalPhotosCount }: ReceiptPhotosProps) {
  if (photos.length === 0) {
    return null;
  }

  const effectiveTotal = totalPhotosCount ?? photos.length;

  return (
    <div className="flex flex-col gap-2 pt-1">
      {/* Evidence Section Header */}
      <div className="flex items-center justify-between border-b border-zinc-200/90 pb-1.5">
        <div className="flex items-center gap-1.5">
          <HugeiconsIcon icon={Camera01Icon} className="size-3.5 text-[#66684f]" />
          <span className="text-3xs font-black uppercase tracking-wider text-zinc-900">
            Scale Deck Camera Evidence ({effectiveTotal} Total Captured)
          </span>
        </div>
        <span className="text-3xs font-medium text-zinc-500 uppercase tracking-wider">
          Grid: {imagesPerRow} per row
        </span>
      </div>

      {/* Responsive Grid */}
      <div
        className="grid gap-2.5"
        style={{
          gridTemplateColumns: `repeat(${imagesPerRow}, minmax(0, 1fr))`,
        }}
      >
        {photos.map((photo, idx) => (
          <div
            key={`${photo.url}-${idx}`}
            className="group relative aspect-video rounded-md overflow-hidden border border-zinc-200 bg-zinc-100 flex flex-col"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={`Scale photo ${idx + 1}`}
              crossOrigin="anonymous"
              className="w-full h-full object-cover"
            />
            {/* Direction Pill */}
            <div className="absolute top-1.5 left-1.5">
              <span
                className={`font-mono text-3xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  photo.direction === "in" ? "bg-[#66684f] text-white" : "bg-zinc-950 text-white"
                }`}
              >
                {photo.direction === "in" ? "TRUCK IN" : "TRUCK OUT"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
