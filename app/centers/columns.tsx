"use client";

import { createColumnHelper } from "@tanstack/react-table";
import {
  DataTableRowActions,
  createCreatedAtColumn,
  createIdColumn,
  createNameColumn,
  createSelectColumn,
  createUpdatedAtColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import { type Center } from "./types";

export interface CentersTableMeta {
  onEditCenter?: (center: Center) => void;
}

const columnHelper = createColumnHelper<DataTableFeatures, Center>();

export const columns = columnHelper.columns([
  createSelectColumn(columnHelper),
  createIdColumn(columnHelper),
  createNameColumn(columnHelper),
  createCreatedAtColumn(columnHelper),
  createUpdatedAtColumn(columnHelper),
  columnHelper.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row, table }) => {
      const center = row.original;
      const meta = table.options.meta as CentersTableMeta | undefined;

      return (
        <DataTableRowActions
          copyText={center.name}
          copyLabel="Copy Center Name"
          onEdit={() => meta?.onEditCenter?.(center)}
          editLabel="Edit Center"
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
  }),
]);
