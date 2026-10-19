"use client";

import { createColumnHelper } from "@tanstack/react-table";
import {
  DataTableColumnHeader,
  createCreatedAtColumn,
  createIdColumn,
  createNameColumn,
  createSelectColumn,
  createUpdatedAtColumn,
  createActionsColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import { RoleBadge } from "@/components/role-badge";
import { AtIcon, SecurityCheckIcon } from "@hugeicons/core-free-icons";
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
        <DataTableColumnHeader column={column} title="Username" icon={AtIcon} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium text-foreground">
          {row.getValue("username")}
        </span>
      ),
      meta: {
        title: "Username",
        icon: AtIcon,
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
    createActionsColumn(columnHelper, ({ row, table }) => {
      const user = row.original;
      const meta = table.options.meta as UsersTableMeta | undefined;

      return {
        copyText: user.username,
        copyLabel: "Copy Username",
        onEdit: () => meta?.onEditUser?.(user),
        editLabel: `Edit ${entityLabel}`,
        onDelete: () => meta?.onDeleteUser?.(user),
        deleteLabel: `Delete ${entityLabel}`,
      };
    }),
  ];

  return columnHelper.columns(allColumns);
}

export const columns = getColumns();
