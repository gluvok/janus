"use client";

import * as React from "react";
import { addDays, endOfMonth, format, isSameDay, startOfMonth, subDays, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePreset {
  label: string;
  getValue: () => DateRange;
}

const PRESETS: DatePreset[] = [
  {
    label: "Today",
    getValue: () => {
      const today = new Date();
      return { from: today, to: today };
    },
  },
  {
    label: "Yesterday",
    getValue: () => {
      const yesterday = subDays(new Date(), 1);
      return { from: yesterday, to: yesterday };
    },
  },
  {
    label: "Last 7 days",
    getValue: () => ({
      from: subDays(new Date(), 6),
      to: new Date(),
    }),
  },
  {
    label: "Last 30 days",
    getValue: () => ({
      from: subDays(new Date(), 29),
      to: new Date(),
    }),
  },
  {
    label: "This month",
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  {
    label: "Last month",
    getValue: () => {
      const prevMonth = subMonths(new Date(), 1);
      return {
        from: startOfMonth(prevMonth),
        to: endOfMonth(prevMonth),
      };
    },
  },
];

function isPresetSelected(preset: DatePreset, current: DateRange | undefined): boolean {
  if (!current?.from) return false;
  const p = preset.getValue();
  if (!p.from) return false;

  const currentTo = current.to ?? current.from;
  const pTo = p.to ?? p.from;

  return isSameDay(current.from, p.from) && isSameDay(currentTo, pTo);
}

export interface DatePickerWithRangeProps {
  date?: DateRange | undefined;
  onDateChange?: (date: DateRange | undefined) => void;
  className?: string;
}

export function DatePickerWithRange({
  date: controlledDate,
  onDateChange,
  className,
}: DatePickerWithRangeProps) {
  const [internalDate, setInternalDate] = React.useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), 0, 20),
    to: addDays(new Date(new Date().getFullYear(), 0, 20), 20),
  });
  const [open, setOpen] = React.useState(false);

  const isControlled = onDateChange !== undefined;
  const date = isControlled ? controlledDate : internalDate;

  const handleSelect = (selected: DateRange | undefined) => {
    if (!isControlled) {
      setInternalDate(selected);
    }
    onDateChange?.(selected);
  };

  const handlePresetSelect = (presetRange: DateRange) => {
    handleSelect(presetRange);
    setOpen(false);
  };

  return (
    <Field className={cn("w-auto", className)}>
      <FieldLabel htmlFor="date-picker-range" className="sr-only">
        Date Picker Range
      </FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              id="date-picker-range"
              className={cn(
                "h-7 max-w-full justify-start gap-1 px-2 text-2xs font-normal",
                !date?.from && "text-muted-foreground",
              )}
            >
              <HugeiconsIcon
                icon={Calendar01Icon}
                data-icon="inline-start"
                className="size-3.5 shrink-0"
              />
              <span className="truncate">
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date</span>
                )}
              </span>
            </Button>
          }
        />
        <PopoverContent className="w-auto max-w-full sm:max-w-none p-0" align="end">
          <div className="flex flex-col divide-y divide-border sm:flex-row sm:divide-x sm:divide-y-0">
            {/* Mobile Top Presets (Visible on <sm, hidden on sm+) */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border p-2 no-scrollbar sm:hidden">
              <span className="shrink-0 px-1 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
                Presets:
              </span>
              {PRESETS.map((preset) => {
                const isSelected = isPresetSelected(preset, date);
                return (
                  <Button
                    key={preset.label}
                    variant={isSelected ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => handlePresetSelect(preset.getValue())}
                    className={cn(
                      "h-6 shrink-0 rounded-full px-2.5 text-2xs font-normal",
                      isSelected && "bg-accent font-medium text-accent-foreground",
                    )}
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div>

            {/* Desktop Left Presets Sidebar (Hidden on <sm, flex on sm+) */}
            <div className="hidden w-32 shrink-0 flex-col gap-1 p-2 sm:flex">
              <span className="px-2 py-1 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
                Presets
              </span>
              {PRESETS.map((preset) => {
                const isSelected = isPresetSelected(preset, date);
                return (
                  <Button
                    key={preset.label}
                    variant={isSelected ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => handlePresetSelect(preset.getValue())}
                    className={cn(
                      "h-7 justify-start px-2 text-xs font-normal",
                      isSelected && "bg-accent font-medium text-accent-foreground",
                    )}
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div>

            {/* Calendar & Footer */}
            <div className="flex flex-col">
              {/* Mobile Single-Month Calendar (block on <sm, hidden on sm+) */}
              <div className="block sm:hidden">
                <Calendar
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={handleSelect}
                  numberOfMonths={1}
                />
              </div>

              {/* Desktop Dual-Month Calendar (hidden on <sm, block on sm+) */}
              <div className="hidden sm:block">
                <Calendar
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={handleSelect}
                  numberOfMonths={2}
                />
              </div>

              {date?.from && (
                <div className="flex items-center justify-between border-t border-border px-3 py-2">
                  <span className="max-w-48 truncate text-2xs text-muted-foreground">
                    {format(date.from, "LLL dd, y")}
                    {date.to ? ` - ${format(date.to, "LLL dd, y")}` : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      handleSelect(undefined);
                      setOpen(false);
                    }}
                    className="h-6 shrink-0 gap-1 px-1.5 text-2xs text-muted-foreground hover:text-foreground"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                    <span>Clear</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </Field>
  );
}

export { DatePickerWithRange as DateRangePicker };
