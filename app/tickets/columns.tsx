"use client";

import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import {
  DataTableColumnHeader,
  createCopyActionsColumn,
  createCreatedAtColumn,
  createIdColumn,
  createSelectColumn,
  createUpdatedAtColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import { RoleBadge } from "@/components/role-badge";
import {
  AtIcon,
  Building02Icon,
  HelpCircleIcon,
  Message01Icon,
  SecurityCheckIcon,
  UserCheck01Icon,
  UserEdit01Icon,
  WeightScale01Icon,
} from "@hugeicons/core-free-icons";
import type { EntityMode } from "@/stores/use-mode-store";
import { TicketStatusBadge } from "./status-badge";
import type { ManualTicket, Ticket } from "./types";

function isManualTicket(row: Ticket): row is ManualTicket {
  return "entry_creator_id" in row;
}

const columnHelper = createColumnHelper<DataTableFeatures, Ticket>();

const leadingSharedColumns: ColumnDef<DataTableFeatures, Ticket, any>[] = [
  createSelectColumn(columnHelper),
  createIdColumn(columnHelper),
  columnHelper.accessor((row) => row.status, {
    id: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" icon={SecurityCheckIcon} />
    ),
    cell: ({ row }) => <TicketStatusBadge status={row.original.status} />,
    meta: {
      title: "Status",
      icon: SecurityCheckIcon,
    },
  }),
  columnHelper.accessor((row) => row.concern, {
    id: "concern",
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
  columnHelper.accessor((row) => row.reply, {
    id: "reply",
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
  columnHelper.accessor((row) => row.vehicle_number, {
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
  columnHelper.accessor((row) => row.entry_id, {
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
  columnHelper.accessor((row) => row.center_name, {
    id: "center_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Center" icon={Building02Icon} />
    ),
    cell: ({ row }) => (
      <Badge variant="secondary" className="text-xs font-normal gap-1">
        <span className="font-mono text-muted-foreground">#{row.original.center_id}</span>
        <span>{row.original.center_name}</span>
      </Badge>
    ),
    meta: {
      title: "Center",
      icon: Building02Icon,
    },
  }),
  columnHelper.accessor((row) => row.center_id, {
    id: "center_id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Center ID" icon={Building02Icon} />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">#{row.original.center_id}</span>
    ),
    meta: {
      title: "Center ID",
      icon: Building02Icon,
    },
  }),
  columnHelper.accessor((row) => row.creator_name, {
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
  columnHelper.accessor((row) => row.creator_id, {
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
  columnHelper.accessor((row) => row.creator_role, {
    id: "creator_role",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Creator Role" icon={SecurityCheckIcon} />
    ),
    cell: ({ row }) => <RoleBadge role={row.original.creator_role} />,
    meta: {
      title: "Creator Role",
      icon: SecurityCheckIcon,
    },
  }),
];

const manualEntryCreatorColumns: ColumnDef<DataTableFeatures, Ticket, any>[] = [
  columnHelper.accessor((row) => (isManualTicket(row) ? row.entry_creator_name : ""), {
    id: "entry_creator_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Entry Created By" icon={UserCheck01Icon} />
    ),
    cell: ({ row }) => {
      const ticket = row.original;
      if (!isManualTicket(ticket)) return null;
      return (
        <div className="flex items-center gap-1.5 whitespace-nowrap text-xs">
          <span className="font-mono text-2xs text-muted-foreground">
            #{ticket.entry_creator_id}
          </span>
          <span className="font-medium text-foreground">{ticket.entry_creator_name}</span>
          <span className="font-mono text-2xs text-muted-foreground">
            @{ticket.entry_creator_username}
          </span>
          <RoleBadge role={ticket.entry_creator_role} />
        </div>
      );
    },
    meta: {
      title: "Entry Created By",
      icon: UserCheck01Icon,
    },
  }),
  columnHelper.accessor((row) => (isManualTicket(row) ? row.entry_creator_id : undefined), {
    id: "entry_creator_id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Entry Creator ID" icon={UserCheck01Icon} />
    ),
    cell: ({ row }) => {
      const ticket = row.original;
      if (!isManualTicket(ticket)) return null;
      return (
        <span className="font-mono text-xs text-muted-foreground">#{ticket.entry_creator_id}</span>
      );
    },
    meta: {
      title: "Entry Creator ID",
      icon: UserCheck01Icon,
    },
  }),
  columnHelper.accessor((row) => (isManualTicket(row) ? row.entry_creator_username : ""), {
    id: "entry_creator_username",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Entry Creator Username" icon={AtIcon} />
    ),
    cell: ({ row }) => {
      const ticket = row.original;
      if (!isManualTicket(ticket)) return null;
      return (
        <span className="font-mono text-xs font-medium text-foreground">
          {ticket.entry_creator_username}
        </span>
      );
    },
    meta: {
      title: "Entry Creator Username",
      icon: AtIcon,
    },
  }),
  columnHelper.accessor((row) => (isManualTicket(row) ? row.entry_creator_role : undefined), {
    id: "entry_creator_role",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Entry Creator Role" icon={SecurityCheckIcon} />
    ),
    cell: ({ row }) => {
      const ticket = row.original;
      if (!isManualTicket(ticket)) return null;
      return <RoleBadge role={ticket.entry_creator_role} />;
    },
    meta: {
      title: "Entry Creator Role",
      icon: SecurityCheckIcon,
    },
  }),
];

const trailingSharedColumns: ColumnDef<DataTableFeatures, Ticket, any>[] = [
  createCreatedAtColumn(columnHelper),
  createUpdatedAtColumn(columnHelper),
  createCopyActionsColumn<Ticket>(columnHelper, ({ row }) => ({
    copyText: String(row.original.id),
    copyLabel: "Copy Ticket ID",
  })),
];

export function getTicketColumns(mode: EntityMode): ColumnDef<DataTableFeatures, Ticket, any>[] {
  return [
    ...leadingSharedColumns,
    ...(mode === "manual" ? manualEntryCreatorColumns : []),
    ...trailingSharedColumns,
  ];
}
