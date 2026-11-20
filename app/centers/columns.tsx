"use client";

import { createColumnHelper } from "@tanstack/react-table";
import {
  createCreatedAtColumn,
  createIdColumn,
  createNameColumn,
  createSelectColumn,
  createUpdatedAtColumn,
  createEditableActionsColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import { type Center } from "./types";

export interface CentersTableMeta {
  onEditCenter: (center: Center) => void;
}

const columnHelper = createColumnHelper<DataTableFeatures, Center>();

export const columns = columnHelper.columns([
  createSelectColumn(columnHelper),
  createIdColumn(columnHelper),
  createNameColumn(columnHelper),
  createCreatedAtColumn(columnHelper),
  createUpdatedAtColumn(columnHelper),
  createEditableActionsColumn(columnHelper, ({ row, table }) => {
    const center = row.original;
    const meta = table.options.meta as CentersTableMeta | undefined;

    return {
      copyText: center.name,
      copyLabel: "Copy Center Name",
      onEdit: () => meta?.onEditCenter(center),
      editLabel: "Edit Center",
    };
  }),
]);
