"use client";

import { createColumnHelper } from "@tanstack/react-table";
import {
  DataTableColumnHeader,
  DataTableRowActions,
  createSelectColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import { RoleBadge } from "@/components/role-badge";
import { formatDateTime } from "@/lib/utils";
import {
  Calendar01Icon,
  Clock01Icon,
  HashtagIcon,
  SecurityCheckIcon,
  TextFontIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { type User } from "./types";

export interface UsersTableMeta {
  onEditUser?: (user: User) => void;
  onDeleteUser?: (user: User) => void;
}

const columnHelper = createColumnHelper<DataTableFeatures, User>();

export function getColumns(options?: { showRole?: boolean; entityLabel?: string }) {
  const showRole = options?.showRole ?? true;
  const entityLabel = options?.entityLabel ?? "User";

  const allColumns = [
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
    columnHelper.accessor("username", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Username" icon={UserIcon} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium text-foreground">
          {row.getValue("username")}
        </span>
      ),
      meta: {
        title: "Username",
        icon: UserIcon,
      },
    }),
    columnHelper.accessor("name", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Full Name" icon={TextFontIcon} />
      ),
      cell: ({ row }) => <span className="text-xs font-medium">{row.getValue("name")}</span>,
      meta: {
        title: "Full Name",
        icon: TextFontIcon,
      },
    }),
    ...(showRole
      ? [
          columnHelper.accessor("role", {
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Role" icon={SecurityCheckIcon} />
            ),
            cell: ({ row }) => <RoleBadge role={row.getValue("role")} />,
            meta: {
              title: "Role",
              icon: SecurityCheckIcon,
            },
          }),
        ]
      : []),
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
        const user = row.original;
        const meta = table.options.meta as UsersTableMeta | undefined;

        return (
          <DataTableRowActions
            copyText={user.username}
            copyLabel="Copy Username"
            onEdit={() => meta?.onEditUser?.(user)}
            editLabel={`Edit ${entityLabel}`}
            onDelete={() => meta?.onDeleteUser?.(user)}
            deleteLabel={`Delete ${entityLabel}`}
          />
        );
      },
      enableSorting: false,
      enableHiding: false,
    }),
  ];

  return columnHelper.columns(allColumns);
}

export const columns = getColumns();
