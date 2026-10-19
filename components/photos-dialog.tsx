"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { Image01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export interface PhotosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  images: string[];
}

export function PhotosDialog({ open, onOpenChange, title, subtitle, images }: PhotosDialogProps) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    const onSelect = () => {
      setCurrent(api.selectedScrollSnap() + 1);
    };

    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  React.useEffect(() => {
    if (open && api) {
      api.scrollTo(0, true);
      setCurrent(1);
    }
  }, [open, api, images]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl gap-4 p-5">
        <DialogHeader className="flex flex-row items-center justify-between gap-2 pr-6">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
              <HugeiconsIcon icon={Image01Icon} className="size-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <DialogTitle className="text-sm font-semibold truncate">{title}</DialogTitle>
              {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
            </div>
          </div>
          {count > 0 && (
            <Badge
              variant="outline"
              className="text-2xs font-normal text-muted-foreground shrink-0"
            >
              {current} of {count}
            </Badge>
          )}
        </DialogHeader>

        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            <HugeiconsIcon icon={Image01Icon} className="size-8 text-muted-foreground/60" />
            <p className="text-xs">No photos available.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="relative px-12">
              <Carousel setApi={setApi} className="w-full">
                <CarouselContent>
                  {images.map((src, idx) => (
                    <CarouselItem key={`${src}-${idx}`}>
                      <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
                        <img
                          src={src}
                          alt={`${title} photo ${idx + 1} of ${images.length}`}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {images.length > 1 && (
                  <>
                    <CarouselPrevious className="size-8 -left-10" />
                    <CarouselNext className="size-8 -right-10" />
                  </>
                )}
              </Carousel>
            </div>

            {/* Thumbnail Dot Navigation */}
            {images.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-1">
                {images.map((_, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => api?.scrollTo(idx)}
                    className={cn(
                      "size-2 rounded-full p-0 transition-all",
                      current === idx + 1
                        ? "bg-primary w-4"
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/60",
                    )}
                    aria-label={`Jump to slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
