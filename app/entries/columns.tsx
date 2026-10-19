"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTableColumnHeader,
  DataTableRowActions,
  createCreatedAtColumn,
  createIdColumn,
  createSelectColumn,
  createUpdatedAtColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Building01Icon,
  Image01Icon,
  TruckIcon,
  UserGroupIcon,
  UserIcon,
  WeightScale01Icon,
} from "@hugeicons/core-free-icons";
import { type Entry, type EntryMode, isManualEntry } from "./types";

const columnHelper = createColumnHelper<DataTableFeatures, Entry>();

export function getColumns(mode: EntryMode) {
  const allColumns = [
    createSelectColumn(columnHelper),
    createIdColumn(columnHelper),
    columnHelper.accessor("vehicle_number", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Vehicle No." icon={TruckIcon} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-foreground">
          {row.original.vehicle_number}
        </span>
      ),
      meta: {
        title: "Vehicle No.",
        icon: TruckIcon,
      },
    }),
    columnHelper.accessor("weight", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Weight" icon={WeightScale01Icon} />
      ),
      cell: ({ row }) => {
        const weight = Number(row.getValue("weight"));
        return (
          <div className="flex items-baseline gap-1 font-mono text-xs">
            <span className="font-semibold text-foreground">{weight.toLocaleString()}</span>
            <span className="text-2xs text-muted-foreground">kg</span>
          </div>
        );
      },
      meta: {
        title: "Weight",
        icon: WeightScale01Icon,
      },
    }),
    ...(mode === "manual"
      ? [
          columnHelper.accessor((row) => (isManualEntry(row) ? row.creator_id : undefined), {
            id: "creator",
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Creator" icon={UserIcon} />
            ),
            cell: ({ row }) => {
              const creator = isManualEntry(row.original) ? row.original.creator : null;
              const creatorId = isManualEntry(row.original) ? row.original.creator_id : null;
              if (!creator) {
                return <span className="text-2xs text-muted-foreground">User #{creatorId}</span>;
              }
              return <span className="text-xs text-muted-foreground">{creator.name}</span>;
            },
            meta: {
              title: "Creator",
              icon: UserIcon,
            },
            enableSorting: true,
          }),
        ]
      : []),
    columnHelper.accessor("center_id", {
      id: "center",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Center" icon={Building01Icon} />
      ),
      cell: ({ row }) => {
        const centerName = row.original.center?.name;
        if (!centerName) {
          return (
            <span className="text-2xs text-muted-foreground">Center #{row.original.center_id}</span>
          );
        }
        return (
          <Badge variant="secondary" className="text-xs font-normal">
            {centerName}
          </Badge>
        );
      },
      meta: {
        title: "Center",
        icon: Building01Icon,
      },
      enableSorting: true,
    }),
    columnHelper.accessor("customer_id", {
      id: "customer",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" icon={UserGroupIcon} />
      ),
      cell: ({ row }) => {
        const customer = row.original.customer;
        if (!customer) {
          return <span className="text-2xs text-muted-foreground italic">Unassigned</span>;
        }
        return <span className="text-xs font-medium text-foreground">{customer.name}</span>;
      },
      meta: {
        title: "Customer",
        icon: UserGroupIcon,
      },
      enableSorting: true,
    }),
    columnHelper.display({
      id: "images",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Photos" icon={Image01Icon} />
      ),
      cell: ({ row, table }) => {
        const count = row.original.images?.length ?? 0;
        if (count === 0) {
          return <span className="text-2xs text-muted-foreground">0</span>;
        }
        const onViewPhotos = (table.options.meta as { onViewPhotos?: (entry: Entry) => void })
          ?.onViewPhotos;
        return (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onViewPhotos?.(row.original)}
            className="h-5 gap-1 rounded-full px-2 py-0 text-2xs text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer"
            title={`View ${count} photo${count > 1 ? "s" : ""}`}
          >
            <HugeiconsIcon icon={Image01Icon} className="size-3" />
            <span>{count}</span>
          </Button>
        );
      },
      meta: {
        title: "Photos",
        icon: Image01Icon,
      },
      enableSorting: false,
    }),
    createCreatedAtColumn(columnHelper),
    createUpdatedAtColumn(columnHelper),
    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <DataTableRowActions copyText={row.original.vehicle_number} copyLabel="Copy Vehicle No." />
      ),
      enableSorting: false,
      enableHiding: false,
    }),
  ];

  return columnHelper.columns(allColumns);
}

export const columns = getColumns("automatic");
