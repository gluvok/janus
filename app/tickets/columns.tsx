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
import { EditableRowActions, FullRowActions } from "@/components/data-table/data-table-row-actions";
import {
  HelpCircleIcon,
  Message01Icon,
  SecurityCheckIcon,
  UserIcon,
  WeightScale01Icon,
} from "@hugeicons/core-free-icons";
import { TicketStatusBadge } from "./status-badge";
import type { Ticket } from "./types";

export interface TicketsTableMeta {
  onEditTicket: (ticket: Ticket) => void;
  onDeleteTicket: (ticket: Ticket) => void;
}

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
  columnHelper.accessor("automatic_weighment_id", {
    id: "weighment",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Weighment" icon={WeightScale01Icon} />
    ),
    cell: ({ row }) => {
      const ticket = row.original;
      return (
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="font-semibold text-foreground">{ticket.weighment.vehicle_number}</span>
          <span className="text-2xs text-muted-foreground">#{ticket.automatic_weighment_id}</span>
        </div>
      );
    },
    meta: {
      title: "Weighment",
      icon: WeightScale01Icon,
    },
  }),
  columnHelper.accessor((row) => row.user.name, {
    id: "user",
    header: ({ column }) => <DataTableColumnHeader column={column} title="User" icon={UserIcon} />,
    cell: ({ row }) => <span className="text-xs font-medium">{row.original.user.name}</span>,
    meta: {
      title: "User",
      icon: UserIcon,
    },
  }),
  createCreatedAtColumn(columnHelper),
  createUpdatedAtColumn(columnHelper),
  columnHelper.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row, table }) => {
      const ticket = row.original;
      const meta = table.options.meta as TicketsTableMeta | undefined;

      if (ticket.status === "pending") {
        return (
          <FullRowActions
            copyText={String(ticket.id)}
            copyLabel="Copy Ticket ID"
            onEdit={() => meta?.onEditTicket(ticket)}
            editLabel="Update Ticket"
            onDelete={() => meta?.onDeleteTicket(ticket)}
            deleteLabel="Delete Ticket"
          />
        );
      }

      return (
        <EditableRowActions
          copyText={String(ticket.id)}
          copyLabel="Copy Ticket ID"
          onEdit={() => meta?.onEditTicket(ticket)}
          editLabel="Update Ticket"
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
  }),
]);
