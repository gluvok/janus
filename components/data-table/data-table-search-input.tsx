"use client";

import { Input } from "@/components/ui/input";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";

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
        className="h-8 w-full pl-8 pr-2.5 text-sm sm:text-xs"
      />
    </div>
  );
}
