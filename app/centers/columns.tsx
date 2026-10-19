"use client";

import { createColumnHelper } from "@tanstack/react-table";
import {
  DataTableColumnHeader,
  DataTableRowActions,
  createSelectColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import { formatDateTime } from "@/lib/utils";
import { Calendar01Icon, Clock01Icon, HashtagIcon, TextFontIcon } from "@hugeicons/core-free-icons";
import { type Center } from "./types";

export interface CentersTableMeta {
  onEditCenter?: (center: Center) => void;
}

const columnHelper = createColumnHelper<DataTableFeatures, Center>();

export const columns = columnHelper.columns([
  createSelectColumn(columnHelper),
  columnHelper.accessor("id", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="ID" icon={HashtagIcon} />,
    cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("id")}</span>,
    meta: {
      title: "ID",
      icon: HashtagIcon,
    },
  }),
  columnHelper.accessor("name", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" icon={TextFontIcon} />
    ),
    cell: ({ row }) => <span className="font-medium text-xs">{row.getValue("name")}</span>,
    meta: {
      title: "Name",
      icon: TextFontIcon,
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
      <span className="text-xs text-muted-foreground">
        {formatDateTime(row.getValue("updated_at"))}
      </span>
    ),
    meta: {
      title: "Updated At",
      icon: Clock01Icon,
    },
  }),
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
