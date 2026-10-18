"use client";

import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { CpuIcon, UserIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useDataTableStore, useTableHydrated } from "@/stores/use-data-table-store";
import type { GlobalMode } from "@/lib/table-cookie";

export interface HeaderModeToggleProps {
  initialGlobalMode: GlobalMode;
}

export function HeaderModeToggle({ initialGlobalMode }: HeaderModeToggleProps) {
  const storeGlobalMode = useDataTableStore((state) => state.globalMode);
  const setGlobalMode = useDataTableStore((state) => state.setGlobalMode);
  const hasHydrated = useTableHydrated();

  const globalMode = hasHydrated ? storeGlobalMode : initialGlobalMode;

  return (
    <div
      role="radiogroup"
      aria-label="Table mode"
      className="inline-flex h-8 w-fit items-center rounded-md border border-border bg-muted/40 p-0.5 text-muted-foreground shrink-0"
    >
      <Button
        type="button"
        role="radio"
        aria-checked={globalMode === "automatic"}
        variant="ghost"
        size="sm"
        onClick={() => setGlobalMode("automatic")}
        className={cn(
          "h-7 gap-1 rounded-sm px-2 text-2xs sm:gap-1.5 sm:px-2.5 sm:text-xs font-medium transition-all cursor-pointer",
          globalMode === "automatic"
            ? "bg-background text-foreground shadow-xs border border-border/50 font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-transparent",
        )}
      >
        <HugeiconsIcon
          icon={CpuIcon}
          className="size-3 text-orange-600 dark:text-orange-400 sm:size-3.5"
        />
        <span className="sm:hidden">Auto</span>
        <span className="hidden sm:inline">Automatic</span>
      </Button>
      <Button
        type="button"
        role="radio"
        aria-checked={globalMode === "manual"}
        variant="ghost"
        size="sm"
        onClick={() => setGlobalMode("manual")}
        className={cn(
          "h-7 gap-1 rounded-sm px-2 text-2xs sm:gap-1.5 sm:px-2.5 sm:text-xs font-medium transition-all cursor-pointer",
          globalMode === "manual"
            ? "bg-background text-foreground shadow-xs border border-border/50 font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-transparent",
        )}
      >
        <HugeiconsIcon
          icon={UserIcon}
          className="size-3 text-stone-600 dark:text-stone-400 sm:size-3.5"
        />
        <span>Manual</span>
      </Button>
    </div>
  );
}
