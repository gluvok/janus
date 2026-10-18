"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DataTableColumnHeader,
  createSelectColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import { formatDateTime } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar01Icon,
  Copy01Icon,
  Delete02Icon,
  Edit01Icon,
  HashtagIcon,
  MoreHorizontalIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { toast } from "@/components/ui/toast";
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
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            <HugeiconsIcon icon={UserGroupIcon} className="size-3.5" />
          </div>
          <span className="font-medium text-xs">{row.getValue("name")}</span>
        </div>
      ),
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
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const customer = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-xs" />}
              className="text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} className="size-3.5" />
              <span className="sr-only">Open actions menu</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs">Customer Actions</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => onEdit(customer)}
                  className="gap-2 text-xs cursor-pointer"
                >
                  <HugeiconsIcon icon={Edit01Icon} className="size-3.5 text-muted-foreground" />
                  <span>Edit Customer</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard.writeText(customer.name);
                    toast.add({
                      type: "success",
                      title: "Copied",
                      description: "Customer name copied to clipboard.",
                    });
                  }}
                  className="gap-2 text-xs cursor-pointer"
                >
                  <HugeiconsIcon icon={Copy01Icon} className="size-3.5 text-muted-foreground" />
                  <span>Copy Name</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard.writeText(String(customer.id));
                    toast.add({
                      type: "success",
                      title: "Copied",
                      description: "Customer ID copied to clipboard.",
                    });
                  }}
                  className="gap-2 text-xs cursor-pointer"
                >
                  <HugeiconsIcon icon={Copy01Icon} className="size-3.5 text-muted-foreground" />
                  <span>Copy ID</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(customer)}
                  className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                >
                  <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                  <span>Delete Customer</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      meta: {
        title: "Actions",
      },
    }),
  ]);
}
