import * as React from "react";

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
    <div className="flex flex-col gap-1.5 pt-1">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-1">
        <span className="text-3xs font-bold uppercase tracking-wider text-zinc-700">
          Transit Photos ({effectiveTotal})
        </span>
        <span className="text-3xs text-zinc-400">{imagesPerRow} per row</span>
      </div>

      <div
        className="grid gap-2"
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
              alt={`Transit photo ${idx + 1}`}
              crossOrigin="anonymous"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-1 left-1">
              <span
                className={`text-3xs font-bold px-1.5 py-0.5 rounded-sm ${
                  photo.direction === "in"
                    ? "bg-zinc-950 text-white"
                    : "bg-zinc-200 text-zinc-950 border border-zinc-300"
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
