"use client";

import { createColumnHelper } from "@tanstack/react-table";
import {
  createCreatedAtColumn,
  createIdColumn,
  createNameColumn,
  createSelectColumn,
  createUpdatedAtColumn,
  createActionsColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import { type Customer } from "./types";

const columnHelper = createColumnHelper<DataTableFeatures, Customer>();

export function getCustomerColumns({
  onEdit,
  onDelete,
}: {
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
}) {
  return columnHelper.columns([
    createSelectColumn(columnHelper),
    createIdColumn(columnHelper),
    createNameColumn(columnHelper),
    createCreatedAtColumn(columnHelper),
    createUpdatedAtColumn(columnHelper),
    createActionsColumn(columnHelper, ({ row }) => {
      const customer = row.original;
      return {
        copyText: customer.name,
        copyLabel: "Copy Customer Name",
        onEdit: () => onEdit(customer),
        editLabel: "Edit Customer",
        onDelete: () => onDelete(customer),
        deleteLabel: "Delete Customer",
      };
    }),
  ]);
}
