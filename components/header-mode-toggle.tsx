"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HugeiconsIcon } from "@hugeicons/react";
import { CpuIcon, UserIcon } from "@hugeicons/core-free-icons";
import { useDataTableStore } from "@/stores/use-data-table-store";
import { globalModeSchema } from "@/lib/table-cookie";
import { cn } from "@/lib/utils";

export interface TableModeToggleProps {
  className?: string;
}

export function TableModeToggle({ className }: TableModeToggleProps) {
  const globalMode = useDataTableStore((state) => state.globalMode);
  const setGlobalMode = useDataTableStore((state) => state.setGlobalMode);

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
      variant="default"
      spacing={0}
      aria-label="Weighment mode"
      className={cn(
        "h-7 rounded-md border border-border/70 bg-muted/50 p-0.5 inline-flex items-center shrink-0",
        className,
      )}
    >
      <ToggleGroupItem
        value="automatic"
        aria-label="Automatic mode"
        className="h-6 gap-1 rounded-sm px-2 text-2xs font-medium cursor-pointer transition-all border border-transparent text-muted-foreground hover:text-foreground data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-xs data-pressed:border-border/60 data-pressed:font-semibold aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs aria-pressed:border-border/60 aria-pressed:font-semibold"
      >
        <HugeiconsIcon icon={CpuIcon} className="size-3 text-orange-600 dark:text-orange-400" />
        <span>Auto</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="manual"
        aria-label="Manual mode"
        className="h-6 gap-1 rounded-sm px-2 text-2xs font-medium cursor-pointer transition-all border border-transparent text-muted-foreground hover:text-foreground data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-xs data-pressed:border-border/60 data-pressed:font-semibold aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs aria-pressed:border-border/60 aria-pressed:font-semibold"
      >
        <HugeiconsIcon icon={UserIcon} className="size-3 text-stone-600 dark:text-stone-400" />
        <span>Manual</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

// Re-export as HeaderModeToggle for backwards compatibility
export { TableModeToggle as HeaderModeToggle };
