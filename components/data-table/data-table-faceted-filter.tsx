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

export interface FacetedFilterOption {
  label: string;
  value: string;
  icon?: React.ComponentProps<typeof HugeiconsIcon>["icon"];
  idPrefix?: string;
}

export interface DataTableFacetedFilterProps {
  title: string;
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"];
  options: FacetedFilterOption[];
  value: string;
  onValueChange: (value: string) => void;
}

export function DataTableFacetedFilter({
  title,
  icon,
  options,
  value,
  onValueChange,
}: DataTableFacetedFilterProps) {
  const [open, setOpen] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const anchor = useComboboxAnchor();

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

  const triggerIcon = isActive ? appIcons.search : selectedOptions.length === 0 ? icon : null;

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
          className="relative min-h-8 w-full sm:w-auto border-input bg-input/20 px-2.5 pr-7 has-data-[slot=combobox-chip]:pr-7 text-2xs font-normal dark:bg-input/30 cursor-text"
        >
          {triggerIcon && (
            <HugeiconsIcon
              icon={triggerIcon}
              className="mr-1.5 size-3.5 shrink-0 text-muted-foreground"
            />
          )}
          <ComboboxValue>
            {selectedOptions.map((item) => (
              <ComboboxChip
                key={item.value}
                className="gap-1 border-stone-300/80 dark:border-stone-700/80 text-2xs"
              >
                <div className="flex items-center gap-1">
                  {item.icon ? (
                    <HugeiconsIcon
                      icon={item.icon}
                      className="size-3 shrink-0 text-muted-foreground"
                    />
                  ) : item.idPrefix ? (
                    <span className="shrink-0 text-muted-foreground font-mono">
                      {item.idPrefix}
                    </span>
                  ) : null}
                  <span className="truncate">{item.label}</span>
                </div>
              </ComboboxChip>
            ))}
          </ComboboxValue>
          <ComboboxChipsInput
            placeholder={placeholderText}
            size={
              selectedOptions.length === 0
                ? Math.max(placeholderText.length, 1)
                : isActive
                  ? Math.max(placeholderText.length, 1)
                  : 1
            }
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
              "flex-initial min-w-0 text-2xs placeholder:text-muted-foreground",
              selectedOptions.length > 0 && !isActive && "w-0 min-w-0 p-0",
            )}
          />
          <ComboboxTrigger className="absolute right-1.5 top-1/2 -translate-y-1/2 shrink-0 cursor-pointer p-0.5 text-muted-foreground hover:text-foreground transition-colors" />
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
                <div className="flex items-center gap-1.5">
                  {item.icon ? (
                    <HugeiconsIcon
                      icon={item.icon}
                      className="size-3.5 shrink-0 text-muted-foreground"
                    />
                  ) : item.idPrefix ? (
                    <span className="shrink-0 text-muted-foreground font-mono tabular-nums text-left">
                      {item.idPrefix}
                    </span>
                  ) : null}
                  <span>{item.label}</span>
                </div>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
