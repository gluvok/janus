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
  Clock01Icon,
  Copy01Icon,
  HashtagIcon,
  MoreHorizontalIcon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { type Center } from "./types";

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
    cell: ({ row }) => {
      const center = row.original;

      return (
        <div className="flex items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" className="size-7 p-0">
                  <HugeiconsIcon icon={MoreHorizontalIcon} className="size-3.5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(String(center.id))}>
                  <HugeiconsIcon icon={Copy01Icon} />
                  <span>Copy Center ID</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(center.name)}>
                  <HugeiconsIcon icon={Copy01Icon} />
                  <span>Copy Center Name</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
  }),
]);
