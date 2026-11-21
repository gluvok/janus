"use client";

import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar01Icon } from "@hugeicons/core-free-icons";
import { DataTableFilterChip } from "./filter-chip";

interface DataTableDateRangeChipProps {
  dateRange?: DateRange;
  onRemove: () => void;
}

export function DataTableDateRangeChip({ dateRange, onRemove }: DataTableDateRangeChipProps) {
  if (!dateRange?.from) return null;

  const value = dateRange.to
    ? `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}`
    : format(dateRange.from, "LLL dd, y");

  return (
    <DataTableFilterChip
      label="Created"
      value={value}
      icon={Calendar01Icon}
      variant="amber"
      onRemove={onRemove}
    />
  );
}
