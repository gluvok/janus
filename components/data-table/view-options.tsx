import type { ReactTable, RowData } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import { SlidersHorizontalIcon } from "@hugeicons/core-free-icons";
import { type DataTableFeatures } from "./features";

interface DataTableViewOptionsProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData>;
}

export function DataTableViewOptions<TData extends RowData>({
  table,
}: DataTableViewOptionsProps<TData>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="ml-auto h-7 gap-1 px-2 text-2xs">
            <HugeiconsIcon icon={SlidersHorizontalIcon} data-icon="inline-start" />
            <span>Columns</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {table
            .getAllColumns()
            .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide())
            .map((column) => {
              const meta = column.columnDef.meta as { title?: string; icon?: unknown } | undefined;
              const title = meta?.title ?? column.id.replace(/_/g, " ");
              const icon = meta?.icon;

              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {icon ? (
                    <HugeiconsIcon
                      icon={icon as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                      className="size-3.5 text-muted-foreground"
                    />
                  ) : null}
                  <span>{title}</span>
                </DropdownMenuCheckboxItem>
              );
            })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
