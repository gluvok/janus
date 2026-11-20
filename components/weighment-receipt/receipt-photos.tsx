import * as React from "react";
import type { Weighment } from "@/app/weighments/types";

interface ReceiptPhotosProps {
  weighment: Weighment;
  imagesPerRow?: number;
}

export function ReceiptPhotos({ weighment, imagesPerRow = 3 }: ReceiptPhotosProps) {
  const inPhotos = (weighment.in_images ?? []).map((url) => ({ url, direction: "in" as const }));
  const outPhotos = (weighment.out_images ?? []).map((url) => ({ url, direction: "out" as const }));
  const allPhotos = [...inPhotos, ...outPhotos].filter((p) => Boolean(p.url));

  if (allPhotos.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-1">
        <span className="text-3xs font-bold uppercase tracking-wider text-zinc-700">
          Transit Photos ({allPhotos.length})
        </span>
        <span className="text-3xs text-zinc-400">{imagesPerRow} per row</span>
      </div>

      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${imagesPerRow}, minmax(0, 1fr))`,
        }}
      >
        {allPhotos.map((photo, idx) => (
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
                className={`text-3xs font-bold px-1.5 py-0.5 rounded-sm shadow-xs ${
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
