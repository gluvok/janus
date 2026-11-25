"use client";

import { createColumnHelper } from "@tanstack/react-table";
import {
  DataTableColumnHeader,
  createCopyActionsColumn,
  createCreatedAtColumn,
  createIdColumn,
  createSelectColumn,
  createUpdatedAtColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import {
  HelpCircleIcon,
  Message01Icon,
  SecurityCheckIcon,
  UserEdit01Icon,
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
  columnHelper.accessor("vehicle_number", {
    id: "vehicle_number",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Entry" icon={WeightScale01Icon} />
    ),
    cell: ({ row }) => {
      const ticket = row.original;
      return (
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-2xs text-muted-foreground">#{ticket.entry_id}</span>
          <span className="font-semibold text-foreground">{ticket.vehicle_number}</span>
        </div>
      );
    },
    meta: {
      title: "Entry",
      icon: WeightScale01Icon,
    },
  }),
  columnHelper.accessor("entry_id", {
    id: "entry_id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Entry ID" icon={WeightScale01Icon} />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">#{row.original.entry_id}</span>
    ),
    meta: {
      title: "Entry ID",
      icon: WeightScale01Icon,
    },
  }),
  columnHelper.accessor("creator_name", {
    id: "creator_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created By" icon={UserEdit01Icon} />
    ),
    cell: ({ row }) => {
      const ticket = row.original;
      return (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-mono text-2xs text-muted-foreground">#{ticket.creator_id}</span>
          <span className="font-medium text-foreground">{ticket.creator_name}</span>
        </div>
      );
    },
    meta: {
      title: "Created By",
      icon: UserEdit01Icon,
    },
  }),
  columnHelper.accessor("creator_id", {
    id: "creator_id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Creator ID" icon={UserEdit01Icon} />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">#{row.original.creator_id}</span>
    ),
    meta: {
      title: "Creator ID",
      icon: UserEdit01Icon,
    },
  }),
  createCreatedAtColumn(columnHelper),
  createUpdatedAtColumn(columnHelper),
  createCopyActionsColumn<Ticket>(columnHelper, ({ row }) => ({
    copyText: String(row.original.id),
    copyLabel: "Copy Ticket ID",
  })),
]);
