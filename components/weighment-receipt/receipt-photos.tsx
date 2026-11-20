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
  startIndex?: number;
}

export function ReceiptPhotos({
  photos,
  imagesPerRow = 3,
  totalPhotosCount,
  startIndex = 0,
}: ReceiptPhotosProps) {
  if (photos.length === 0) {
    return null;
  }

  const effectiveTotal = totalPhotosCount ?? photos.length;

  return (
    <div className="flex flex-col gap-2 pt-1">
      {/* Evidence Section Header (No Grid: 3 per row text) */}
      <div className="flex items-center gap-1.5 border-b border-zinc-200/90 pb-1.5">
        <HugeiconsIcon icon={Camera01Icon} className="size-3.5 text-[#66684f]" />
        <span className="text-3xs font-black uppercase tracking-wider text-zinc-900">
          Scale Deck Camera Evidence ({effectiveTotal} Total Captured)
        </span>
      </div>

      {/* Responsive Grid */}
      <div
        className="grid gap-2.5"
        style={{
          gridTemplateColumns: `repeat(${imagesPerRow}, minmax(0, 1fr))`,
        }}
      >
        {photos.map((photo, idx) => {
          const photoNumber = startIndex + idx + 1;
          const isEntry = photo.direction === "in";

          return (
            <div
              key={`${photo.url}-${idx}`}
              className="group relative aspect-video rounded-md overflow-hidden border border-zinc-200 bg-zinc-100 flex flex-col"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Scale photo ${photoNumber}`}
                crossOrigin="anonymous"
                className="w-full h-full object-cover"
              />

              {/* Minimalist IN / OUT Badge */}
              <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                <span
                  className={`font-mono text-3xs font-black px-1.5 py-0.5 rounded tracking-widest uppercase ${
                    isEntry ? "bg-[#66684f] text-white" : "bg-zinc-950 text-white"
                  }`}
                >
                  {isEntry ? "IN" : "OUT"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
