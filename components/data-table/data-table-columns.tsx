"use client";

import type { ColumnDef, ColumnHelper, RowData } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import type { DataTableFeatures } from "./data-table-features";

export function createSelectColumn<TData extends RowData>(
  columnHelper: ColumnHelper<DataTableFeatures, TData>,
): ColumnDef<DataTableFeatures, TData, unknown> {
  return columnHelper.display({
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="size-4"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="size-4"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  });
}
