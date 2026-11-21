"use client";

import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export interface DataTableClearButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
}

export function DataTableClearButton({ label, onClick, className }: DataTableClearButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "h-7 gap-1 px-2 text-2xs text-muted-foreground hover:bg-stone-500/10 hover:text-foreground shrink-0 cursor-pointer",
        className,
      )}
    >
      <HugeiconsIcon icon={Cancel01Icon} className="size-3" data-icon="inline-start" />
      <span>{label}</span>
    </Button>
  );
}
