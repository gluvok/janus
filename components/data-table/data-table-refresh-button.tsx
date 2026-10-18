"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export interface DataTableRefreshButtonProps {
  onClick?: () => void;
  loading?: boolean;
  className?: string;
}

export function DataTableRefreshButton({
  onClick,
  loading,
  className,
}: DataTableRefreshButtonProps) {
  const [internalSpinning, setInternalSpinning] = useState<boolean>(false);

  const isSpinning = loading ?? internalSpinning;

  const handleClick = () => {
    if (loading === undefined) {
      setInternalSpinning(true);
      setTimeout(() => setInternalSpinning(false), 600);
    }
    onClick?.();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isSpinning}
      className={cn(
        "h-7 gap-1 px-2 text-2xs text-muted-foreground hover:text-foreground cursor-pointer shrink-0",
        className,
      )}
      title="Refresh data"
      aria-label="Refresh data"
    >
      <HugeiconsIcon
        icon={RefreshIcon}
        className={cn("size-3.5", isSpinning && "animate-spin")}
        data-icon="inline-start"
      />
      <span>Refresh</span>
    </Button>
  );
}
