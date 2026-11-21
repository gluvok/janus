import * as React from "react";
import { cn } from "@/lib/utils";

export interface ReceiptPhotoItem {
  url: string;
  direction: "in" | "out";
}

interface ReceiptPhotosProps {
  photos: ReceiptPhotoItem[];
  imagesPerRow: number;
  totalPhotosCount?: number;
  startIndex?: number;
}

export function ReceiptPhotos({
  photos,
  imagesPerRow,
  totalPhotosCount,
  startIndex = 0,
}: ReceiptPhotosProps) {
  if (photos.length === 0) {
    return null;
  }

  const effectiveTotal = totalPhotosCount ?? photos.length;
  const isSingleColumn = imagesPerRow === 1;

  return (
    <div className="flex flex-col gap-1.5 pt-0.5">
      {/* Evidence Section Header */}
      <div className="flex items-center justify-between border-b border-zinc-200/80 pb-1">
        <span className="font-heading text-3xs font-semibold text-zinc-400">
          Transit Evidence ({effectiveTotal})
        </span>
      </div>

      {/* Responsive Grid */}
      <div className={cn("grid gap-2", imagesPerRow === 1 ? "grid-cols-1" : "grid-cols-2")}>
        {photos.map((photo, idx) => {
          const photoNumber = startIndex + idx + 1;
          const isEntry = photo.direction === "in";

          return (
            <div
              key={`${photo.url}-${idx}`}
              className={`group relative rounded-none overflow-hidden bg-zinc-100 flex flex-col border-0 ${
                isSingleColumn ? "h-92" : "aspect-video"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Scale photo ${photoNumber}`}
                crossOrigin="anonymous"
                className="w-full h-full object-cover rounded-none"
              />

              {/* Minimalist In / Out Badge */}
              <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                <span
                  className={`font-heading text-3xs font-semibold px-1.5 py-0.5 rounded-none ${
                    isEntry ? "bg-[#66684f] text-white" : "bg-zinc-950 text-white"
                  }`}
                >
                  {isEntry ? "In" : "Out"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
