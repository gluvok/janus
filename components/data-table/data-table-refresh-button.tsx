"use client";

import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export interface DataTableRefreshButtonProps {
  onClick: () => void;
  loading: boolean;
}

export function DataTableRefreshButton({ onClick, loading }: DataTableRefreshButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={loading}
      className="h-7 gap-1 px-2 text-2xs text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
      aria-label="Refresh table data"
    >
      <HugeiconsIcon
        icon={RefreshIcon}
        className={cn("size-3.5 shrink-0", loading && "animate-spin text-primary")}
      />
      <span>Refresh</span>
    </Button>
  );
}
