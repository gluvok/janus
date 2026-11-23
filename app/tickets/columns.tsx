"use client";

import { createColumnHelper } from "@tanstack/react-table";
import {
  DataTableColumnHeader,
  createCreatedAtColumn,
  createIdColumn,
  createSelectColumn,
  createUpdatedAtColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import { CopyRowAction } from "@/components/data-table/row-actions";
import {
  HelpCircleIcon,
  Message01Icon,
  SecurityCheckIcon,
  WeightScale01Icon,
} from "@hugeicons/core-free-icons";
import { TicketStatusBadge } from "./status-badge";
import type { Ticket } from "./types";

const columnHelper = createColumnHelper<DataTableFeatures, Ticket>();

export const columns = columnHelper.columns([
  createSelectColumn(columnHelper),
  createIdColumn(columnHelper),
  columnHelper.accessor("status", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" icon={SecurityCheckIcon} />
    ),
    cell: ({ row }) => <TicketStatusBadge status={row.getValue("status")} />,
    meta: {
      title: "Status",
      icon: SecurityCheckIcon,
    },
  }),
  columnHelper.accessor("concern", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Concern" icon={HelpCircleIcon} />
    ),
    cell: ({ row }) => (
      <span
        className="text-xs font-medium text-foreground max-w-xs truncate block"
        title={row.original.concern}
      >
        {row.original.concern}
      </span>
    ),
    meta: {
      title: "Concern",
      icon: HelpCircleIcon,
    },
  }),
  columnHelper.accessor("reply", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Reply" icon={Message01Icon} />
    ),
    cell: ({ row }) => (
      <span
        className="text-xs text-muted-foreground max-w-xs truncate block"
        title={row.original.reply ?? "—"}
      >
        {row.original.reply ?? "—"}
      </span>
    ),
    meta: {
      title: "Reply",
      icon: Message01Icon,
    },
  }),
  columnHelper.accessor("entry_id", {
    id: "entry",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Entry" icon={WeightScale01Icon} />
    ),
    cell: ({ row }) => {
      const ticket = row.original;
      return (
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="font-semibold text-foreground">{ticket.entry.vehicle_number}</span>
          <span className="text-2xs text-muted-foreground">#{ticket.entry_id}</span>
        </div>
      );
    },
    meta: {
      title: "Entry",
      icon: WeightScale01Icon,
    },
  }),
  createCreatedAtColumn(columnHelper),
  createUpdatedAtColumn(columnHelper),
  columnHelper.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const ticket = row.original;
      return <CopyRowAction copyText={String(ticket.id)} copyLabel="Copy Ticket ID" />;
    },
    enableSorting: false,
    enableHiding: false,
  }),
]);
