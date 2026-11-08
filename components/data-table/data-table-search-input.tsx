"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export interface DataTableSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function DataTableSearchInput({
  value,
  onChange,
  placeholder = "Search...",
}: DataTableSearchInputProps) {
  return (
    <div className="relative w-full sm:w-60">
      <HugeiconsIcon
        icon={Search01Icon}
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-8 w-full pl-8 text-sm sm:text-xs", value ? "pr-8" : "pr-2.5")}
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onChange("")}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
        </Button>
      ) : null}
    </div>
  );
}
