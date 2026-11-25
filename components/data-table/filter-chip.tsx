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
    container: "border-border bg-muted",
    valueIcon: "text-muted-foreground",
    value: "text-muted-foreground",
    dismiss: "text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground",
  },
  emerald: {
    container: "border-success/25 bg-success/10",
    valueIcon: "text-success",
    value: "text-success",
    dismiss: "text-success/70 hover:bg-success/20 hover:text-success",
  },
  orange: {
    container: "border-terracotta/25 bg-terracotta/10",
    valueIcon: "text-terracotta",
    value: "text-terracotta",
    dismiss: "text-terracotta/70 hover:bg-terracotta/20 hover:text-terracotta",
  },
  amber: {
    container: "border-warning/25 bg-warning/10",
    valueIcon: "text-warning",
    value: "text-warning",
    dismiss: "text-warning/70 hover:bg-warning/20 hover:text-warning",
  },
  primary: {
    container: "border-primary/25 bg-primary/10",
    valueIcon: "text-primary",
    value: "text-primary",
    dismiss: "text-primary/70 hover:bg-primary/20 hover:text-primary",
  },
  zinc: {
    container: "border-border bg-secondary",
    valueIcon: "text-foreground",
    value: "text-foreground",
    dismiss: "text-muted-foreground hover:bg-muted hover:text-foreground",
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
