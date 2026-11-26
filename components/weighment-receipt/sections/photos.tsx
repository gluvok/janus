import { cn } from "@/lib/utils";

export interface ReceiptPhotoItem {
  url: string;
  direction?: "in" | "out";
}

interface ReceiptPhotosProps {
  photos: ReceiptPhotoItem[];
  imagesPerRow: number;
  totalPhotosCount?: number;
  startIndex?: number;
  direction?: "in" | "out";
  heading?: string;
}

export function ReceiptPhotos({
  photos,
  imagesPerRow,
  totalPhotosCount,
  startIndex = 0,
  direction,
  heading = "Transit Evidence",
}: ReceiptPhotosProps) {
  if (photos.length === 0) {
    return null;
  }

  const effectiveTotal = totalPhotosCount ?? photos.length;
  const isSingleColumn = imagesPerRow === 1;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between border-b border-[#dfddd2] pb-1.5">
        <span className="font-heading text-3xs font-semibold text-[#5f6558]">
          {heading} ({effectiveTotal})
        </span>
      </div>

      <div className={cn("grid gap-3", isSingleColumn ? "grid-cols-1" : "grid-cols-2")}>
        {photos.map((photo, idx) => {
          const photoNumber = startIndex + idx + 1;
          const resolvedDirection = photo.direction ?? direction;

          return (
            <div
              key={`${photo.url}-${idx}`}
              className={cn(
                "group relative rounded-lg overflow-hidden bg-[#fcfbf8] flex flex-col border border-[#dfddd2]",
                isSingleColumn ? "h-72" : "aspect-video",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Scale photo ${photoNumber}`}
                crossOrigin="anonymous"
                className="w-full h-full object-cover"
              />

              {resolvedDirection !== undefined && (
                <div className="absolute top-2 left-2 flex items-center gap-1">
                  <span
                    className={cn(
                      "font-heading text-3xs font-semibold px-2 py-0.5 rounded-md",
                      resolvedDirection === "in"
                        ? "bg-[#4a6741] text-[#f7f6f2]"
                        : "bg-[#9c4a2d] text-[#f7f6f2]",
                    )}
                  >
                    {resolvedDirection === "in" ? "In" : "Out"}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
