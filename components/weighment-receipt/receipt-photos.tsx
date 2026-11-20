import * as React from "react";

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
      {/* Evidence Section Header */}
      <div className="flex items-center justify-between border-b border-zinc-200/80 pb-1.5">
        <span className="text-3xs font-black uppercase tracking-widest text-zinc-400">
          Transit Evidence ({effectiveTotal})
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
              className="group relative aspect-video rounded-none overflow-hidden bg-zinc-100 flex flex-col border-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Scale photo ${photoNumber}`}
                crossOrigin="anonymous"
                className="w-full h-full object-cover rounded-none"
              />

              {/* Minimalist IN / OUT Badge */}
              <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                <span
                  className={`font-mono text-3xs font-black px-1.5 py-0.5 rounded-none tracking-widest uppercase ${
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
