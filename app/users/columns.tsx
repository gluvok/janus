"use client";

import { createColumnHelper } from "@tanstack/react-table";
import {
  DataTableColumnHeader,
  DataTableRowActions,
  createCreatedAtColumn,
  createIdColumn,
  createNameColumn,
  createSelectColumn,
  createUpdatedAtColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import { RoleBadge } from "@/components/role-badge";
import { SecurityCheckIcon, UserIcon } from "@hugeicons/core-free-icons";
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
    createIdColumn(columnHelper),
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
    createNameColumn(columnHelper, { title: "Full Name" }),
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
    createCreatedAtColumn(columnHelper),
    createUpdatedAtColumn(columnHelper),
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
