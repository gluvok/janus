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
import { UserGroupIcon } from "@hugeicons/core-free-icons";
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
    createNameColumn(columnHelper, { icon: UserGroupIcon }),
    createCreatedAtColumn(columnHelper),
    createUpdatedAtColumn(columnHelper),
    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const customer = row.original;
        return (
          <DataTableRowActions
            copyText={customer.name}
            copyLabel="Copy Customer Name"
            onEdit={() => onEdit(customer)}
            editLabel="Edit Customer"
            onDelete={() => onDelete(customer)}
            deleteLabel="Delete Customer"
          />
        );
      },
      meta: {
        title: "Actions",
      },
    }),
  ]);
}
