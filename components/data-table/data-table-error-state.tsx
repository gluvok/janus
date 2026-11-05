"use client";

import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon } from "@hugeicons/core-free-icons";

export interface DataTableErrorStateProps {
  title?: string;
  error: string;
  onRetry: () => void;
}

export function DataTableErrorState({
  title = "Failed to load data",
  error,
  onRetry,
}: DataTableErrorStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center min-h-64">
      <div className="flex flex-col items-center gap-3 max-w-sm">
        <div className="p-3 rounded-full bg-destructive/10 text-destructive">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-2 h-8 text-xs cursor-pointer"
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
