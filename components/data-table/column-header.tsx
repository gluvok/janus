import type { Column, RowData } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  EyeIcon,
  Sorting05Icon,
} from "@hugeicons/core-free-icons";
import { type DataTableFeatures } from "./features";

export interface DataTableColumnHeaderProps<TData extends RowData, TValue = unknown> {
  column: Column<DataTableFeatures, TData, TValue>;
  title: string;
  icon?: unknown;
}

export function DataTableColumnHeader<TData extends RowData, TValue = unknown>({
  column,
  title,
  icon: customIcon,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const icon = customIcon ?? column.columnDef.meta?.icon;

  if (!column.getCanSort()) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {icon ? (
          <HugeiconsIcon
            icon={icon as Parameters<typeof HugeiconsIcon>[0]["icon"]}
            className="size-3.5 text-muted-foreground"
            data-icon="inline-start"
          />
        ) : null}
        <span>{title}</span>
      </div>
    );
  }

  const isSorted = column.getIsSorted();
  const sortIndex = column.getSortIndex();
  const sortingState = column.table.options.state?.sorting ?? [];
  const hasMultipleSorts = sortingState.length > 1;

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                if (e.shiftKey) {
                  e.preventDefault();
                  column.toggleSorting(undefined, true);
                }
              }}
              className="-ml-2 h-7 gap-1 px-2 text-xs data-popup-open:bg-accent"
            >
              {icon ? (
                <HugeiconsIcon
                  icon={icon as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                  className="size-3.5 text-muted-foreground"
                  data-icon="inline-start"
                />
              ) : null}
              <span>{title}</span>
              {isSorted === "desc" ? (
                <HugeiconsIcon icon={ArrowDown01Icon} data-icon="inline-end" />
              ) : isSorted === "asc" ? (
                <HugeiconsIcon icon={ArrowUp01Icon} data-icon="inline-end" />
              ) : (
                <HugeiconsIcon
                  icon={Sorting05Icon}
                  data-icon="inline-end"
                  className="text-muted-foreground/70"
                />
              )}
              {hasMultipleSorts && sortIndex >= 0 ? (
                <span className="flex size-3.5 items-center justify-center rounded-full bg-primary/15 text-2xs font-semibold text-primary">
                  {sortIndex + 1}
                </span>
              ) : null}
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-38">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => column.toggleSorting(false, false)}>
              <HugeiconsIcon icon={ArrowUp01Icon} />
              <span>{sortingState.length > 1 ? "Sort only: Asc" : "Asc"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => column.toggleSorting(true, false)}>
              <HugeiconsIcon icon={ArrowDown01Icon} />
              <span>{sortingState.length > 1 ? "Sort only: Desc" : "Desc"}</span>
            </DropdownMenuItem>

            {!isSorted && sortingState.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => column.toggleSorting(false, true)}>
                  <HugeiconsIcon icon={ArrowUp01Icon} />
                  <span>Add to sort (Asc)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => column.toggleSorting(true, true)}>
                  <HugeiconsIcon icon={ArrowDown01Icon} />
                  <span>Add to sort (Desc)</span>
                </DropdownMenuItem>
              </>
            )}

            {isSorted && hasMultipleSorts ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => column.clearSorting()}>
                  <HugeiconsIcon icon={Cancel01Icon} />
                  <span>Remove from sort</span>
                </DropdownMenuItem>
              </>
            ) : null}

            {column.getCanHide() && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
                  <HugeiconsIcon icon={EyeIcon} />
                  <span>Hide</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
