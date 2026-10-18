"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HugeiconsIcon } from "@hugeicons/react";
import { CpuIcon, UserIcon } from "@hugeicons/core-free-icons";
import { useDataTableStore, useTableHydrated } from "@/stores/use-data-table-store";
import { globalModeSchema, type GlobalMode } from "@/lib/table-cookie";

export interface HeaderModeToggleProps {
  initialGlobalMode: GlobalMode;
}

export function HeaderModeToggle({ initialGlobalMode }: HeaderModeToggleProps) {
  const storeGlobalMode = useDataTableStore((state) => state.globalMode);
  const setGlobalMode = useDataTableStore((state) => state.setGlobalMode);
  const hasHydrated = useTableHydrated();

  const globalMode = hasHydrated ? storeGlobalMode : initialGlobalMode;

  const handleValueChange = (values: string[]) => {
    if (values.length === 0) return;
    const parsed = globalModeSchema.safeParse(values[0]);
    if (parsed.success) {
      setGlobalMode(parsed.data);
    }
  };

  return (
    <ToggleGroup
      value={[globalMode]}
      onValueChange={handleValueChange}
      variant="outline"
      spacing={0}
      aria-label="Table mode"
      className="h-8"
    >
      <ToggleGroupItem
        value="automatic"
        aria-label="Automatic mode"
        className="h-7 gap-1 px-2 text-2xs sm:gap-1.5 sm:px-2.5 sm:text-xs font-medium cursor-pointer transition-all data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-xs data-pressed:font-semibold aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs aria-pressed:font-semibold"
      >
        <HugeiconsIcon
          icon={CpuIcon}
          className="size-3 text-orange-600 dark:text-orange-400 sm:size-3.5"
        />
        <span className="sm:hidden">Auto</span>
        <span className="hidden sm:inline">Automatic</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="manual"
        aria-label="Manual mode"
        className="h-7 gap-1 px-2 text-2xs sm:gap-1.5 sm:px-2.5 sm:text-xs font-medium cursor-pointer transition-all data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-xs data-pressed:font-semibold aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs aria-pressed:font-semibold"
      >
        <HugeiconsIcon
          icon={UserIcon}
          className="size-3 text-stone-600 dark:text-stone-400 sm:size-3.5"
        />
        <span>Manual</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
