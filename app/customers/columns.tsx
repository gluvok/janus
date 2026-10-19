"use client";

import { createColumnHelper } from "@tanstack/react-table";
import {
  DataTableColumnHeader,
  DataTableRowActions,
  createSelectColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import { formatDateTime } from "@/lib/utils";
import {
  Calendar01Icon,
  Clock01Icon,
  HashtagIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
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
    columnHelper.accessor("id", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ID" icon={HashtagIcon} />
      ),
      cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("id")}</span>,
      meta: {
        title: "ID",
        icon: HashtagIcon,
      },
    }),
    columnHelper.accessor("name", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" icon={UserGroupIcon} />
      ),
      cell: ({ row }) => <span className="font-medium text-xs">{row.getValue("name")}</span>,
      meta: {
        title: "Name",
        icon: UserGroupIcon,
      },
    }),
    columnHelper.accessor("created_at", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created At" icon={Calendar01Icon} />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatDateTime(row.getValue("created_at"))}
        </span>
      ),
      meta: {
        title: "Created At",
        icon: Calendar01Icon,
      },
    }),
    columnHelper.accessor("updated_at", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Updated At" icon={Clock01Icon} />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDateTime(row.getValue("updated_at"))}
        </span>
      ),
      meta: {
        title: "Updated At",
        icon: Clock01Icon,
      },
      enableSorting: true,
    }),
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
