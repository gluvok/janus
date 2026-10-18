"use client";

import * as React from "react";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { HugeiconsIcon } from "@hugeicons/react";
import { appIcons } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { FacetedFilterOption } from "./data-table-faceted-filter";

export interface DataTableMultiComboboxFilterProps {
  title: string;
  icon?: React.ComponentProps<typeof HugeiconsIcon>["icon"];
  options: FacetedFilterOption[];
  value: string;
  onValueChange: (value: string) => void;
}

export function DataTableMultiComboboxFilter({
  title,
  icon,
  options,
  value,
  onValueChange,
}: DataTableMultiComboboxFilterProps) {
  const [open, setOpen] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const anchor = useComboboxAnchor();
  const leadingIcon = icon ?? appIcons.centers;

  // Filter out sentinel "all" option from selectable list
  const selectableOptions = React.useMemo(() => {
    return options.filter((opt) => opt.value !== "all");
  }, [options]);

  // Selected options derived from comma-separated value prop
  const selectedOptions = React.useMemo(() => {
    if (!value || value === "all") return [];
    const idSet = new Set(value.split(",").filter(Boolean));
    return selectableOptions.filter((opt) => idSet.has(opt.value));
  }, [selectableOptions, value]);

  const isActive = open || isFocused;
  const placeholderText = React.useMemo(() => {
    const pluralTitle = title.endsWith("s") ? title : `${title}s`;
    if (selectedOptions.length === 0) {
      return isActive ? `Search ${pluralTitle.toLowerCase()}...` : `All ${pluralTitle}`;
    }
    return isActive ? `Add ${title.toLowerCase()}...` : "";
  }, [isActive, selectedOptions.length, title]);

  const handleSelectedChange = React.useCallback(
    (newItems: FacetedFilterOption[]) => {
      if (!newItems || newItems.length === 0) {
        onValueChange("all");
      } else {
        onValueChange(newItems.map((item) => item.value).join(","));
      }
    },
    [onValueChange],
  );

  const triggerIcon = isActive
    ? appIcons.search
    : selectedOptions.length === 0
      ? leadingIcon
      : null;

  return (
    <div className="w-full sm:w-auto">
      <Combobox
        items={selectableOptions}
        multiple
        open={open}
        onOpenChange={setOpen}
        value={selectedOptions}
        onValueChange={handleSelectedChange}
        itemToStringLabel={(item) =>
          item ? (item.idPrefix ? `${item.idPrefix} ${item.label}` : item.label) : ""
        }
        itemToStringValue={(item) => (item ? item.value : "")}
        isItemEqualToValue={(a, b) => a?.value === b?.value}
      >
        <ComboboxChips
          ref={anchor}
          className="min-h-8 w-full sm:w-auto border-input bg-input/20 px-2.5 text-2xs font-normal dark:bg-input/30 cursor-text"
        >
          {triggerIcon && (
            <HugeiconsIcon
              icon={triggerIcon}
              className="size-3.5 shrink-0 text-muted-foreground mr-1"
            />
          )}
          <ComboboxValue>
            {selectedOptions.map((item) => (
              <ComboboxChip
                key={item.value}
                className="gap-1 bg-stone-500/10 text-stone-800 dark:bg-stone-900/40 dark:text-stone-200 border border-stone-300/80 dark:border-stone-700/80 text-2xs"
              >
                {item.idPrefix && (
                  <span className="shrink-0 text-muted-foreground font-mono">{item.idPrefix}</span>
                )}
                <span className="truncate">{item.label}</span>
              </ComboboxChip>
            ))}
          </ComboboxValue>
          <ComboboxChipsInput
            placeholder={placeholderText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
              "text-2xs placeholder:text-muted-foreground",
              selectedOptions.length === 0 ? "min-w-28" : isActive ? "min-w-20" : "w-0 min-w-0 p-0",
            )}
          />
          <ComboboxTrigger className="ml-auto shrink-0 cursor-pointer p-0.5 text-muted-foreground hover:text-foreground transition-colors" />
        </ComboboxChips>
        <ComboboxContent
          anchor={anchor}
          className="w-max min-w-(--anchor-width) max-w-xs sm:max-w-sm"
        >
          <ComboboxEmpty className="py-2 text-center text-xs text-muted-foreground">
            No {title.toLowerCase()} found.
          </ComboboxEmpty>
          <ComboboxList>
            {(item: FacetedFilterOption) => (
              <ComboboxItem
                key={item.value}
                value={item}
                className="text-xs whitespace-nowrap cursor-pointer pr-6"
              >
                {item.idPrefix && (
                  <span className="inline-block w-8 shrink-0 text-muted-foreground font-mono tabular-nums text-left mr-1.5">
                    {item.idPrefix}
                  </span>
                )}
                <span>{item.label}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
