"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export type FilterChipVariant = "stone" | "emerald" | "orange" | "amber" | "primary" | "zinc";

interface DataTableFilterChipProps {
  label: string;
  value: string;
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
  variant: FilterChipVariant;
  onRemove: () => void;
}

const VARIANT_STYLES: Record<
  FilterChipVariant,
  {
    container: string;
    valueIcon: string;
    value: string;
    dismiss: string;
  }
> = {
  stone: {
    container: "border-stone-500/20 bg-stone-500/10 dark:border-stone-500/30 dark:bg-stone-900/20",
    valueIcon: "text-stone-700 dark:text-stone-300",
    value: "text-stone-700 dark:text-stone-300",
    dismiss: "text-stone-500 hover:bg-stone-500/20 hover:text-stone-900 dark:hover:text-stone-100",
  },
  emerald: {
    container:
      "border-emerald-500/20 bg-emerald-500/10 dark:border-emerald-500/30 dark:bg-emerald-950/20",
    valueIcon: "text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-600 dark:text-emerald-400",
    dismiss:
      "text-emerald-600/70 hover:bg-emerald-500/20 hover:text-emerald-600 dark:text-emerald-400/70 dark:hover:text-emerald-400",
  },
  orange: {
    container:
      "border-orange-500/20 bg-orange-500/10 dark:border-orange-500/30 dark:bg-orange-950/20",
    valueIcon: "text-orange-600 dark:text-orange-400",
    value: "text-orange-600 dark:text-orange-400",
    dismiss:
      "text-orange-600/70 hover:bg-orange-500/20 hover:text-orange-600 dark:text-orange-400/70 dark:hover:text-orange-400",
  },
  amber: {
    container: "border-amber-500/20 bg-amber-500/10 dark:border-amber-500/30 dark:bg-amber-950/20",
    valueIcon: "text-amber-600 dark:text-amber-400",
    value: "text-amber-600 dark:text-amber-400",
    dismiss:
      "text-amber-600/70 hover:bg-amber-500/20 hover:text-amber-600 dark:text-amber-400/70 dark:hover:text-amber-400",
  },
  primary: {
    container: "border-primary/25 bg-primary/10 dark:border-primary/35 dark:bg-primary/15",
    valueIcon: "text-primary",
    value: "text-primary",
    dismiss: "text-primary/70 hover:bg-primary/20 hover:text-primary",
  },
  zinc: {
    container: "border-zinc-500/20 bg-zinc-500/10 dark:border-zinc-500/30 dark:bg-zinc-800/20",
    valueIcon: "text-zinc-600 dark:text-zinc-400",
    value: "text-zinc-600 dark:text-zinc-400",
    dismiss: "text-zinc-500 hover:bg-zinc-500/20 hover:text-zinc-900 dark:hover:text-zinc-100",
  },
};

export function DataTableFilterChip({
  label,
  value,
  icon,
  variant,
  onRemove,
}: DataTableFilterChipProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 inline-flex items-center shrink-0 gap-1 rounded-md px-1.5 text-2xs font-normal shadow-2xs select-none",
        styles.container,
      )}
    >
      <HugeiconsIcon
        icon={icon}
        className="size-2.5 shrink-0 text-muted-foreground"
        data-icon="inline-start"
      />
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn("font-medium", styles.value)}>{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        className={cn("size-3 rounded p-0", styles.dismiss)}
        aria-label={`Remove ${label} filter`}
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-2" />
      </Button>
    </Badge>
  );
}
