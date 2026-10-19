"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTableColumnHeader,
  DataTableRowActions,
  createSelectColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import { formatDateTime } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Building01Icon,
  Calendar01Icon,
  Clock01Icon,
  Exchange01Icon,
  HashtagIcon,
  Image01Icon,
  TruckIcon,
  UserGroupIcon,
  WeightScale01Icon,
} from "@hugeicons/core-free-icons";
import { WeighmentTypeBadge } from "@/components/weighment-type-badge";
import type { Weighment } from "./types";

const columnHelper = createColumnHelper<DataTableFeatures, Weighment>();

export interface WeighmentsTableMeta {
  onViewPhotos?: (title: string, subtitle: string, images: string[]) => void;
}

export function getWeighmentColumns() {
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
    columnHelper.accessor("type", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" icon={Exchange01Icon} />
      ),
      cell: ({ row }) => <WeighmentTypeBadge type={row.getValue("type")} />,
      meta: {
        title: "Type",
        icon: Exchange01Icon,
      },
    }),
    columnHelper.accessor("net_weight", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Net Weight" icon={WeightScale01Icon} />
      ),
      cell: ({ row }) => {
        const net = Number(row.getValue("net_weight"));
        return (
          <div className="flex items-baseline gap-1 font-mono text-xs">
            <span className="font-bold text-foreground">{net.toLocaleString()}</span>
            <span className="text-2xs text-muted-foreground">kg</span>
          </div>
        );
      },
      meta: {
        title: "Net Weight",
        icon: WeightScale01Icon,
      },
    }),
    columnHelper.accessor("gross_weight", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Gross" icon={WeightScale01Icon} />
      ),
      cell: ({ row }) => {
        const gross = Number(row.getValue("gross_weight"));
        return (
          <div className="flex items-baseline gap-1 font-mono text-xs">
            <span className="font-medium text-foreground">{gross.toLocaleString()}</span>
            <span className="text-2xs text-muted-foreground">kg</span>
          </div>
        );
      },
      meta: {
        title: "Gross",
        icon: WeightScale01Icon,
      },
    }),
    columnHelper.accessor("tare_weight", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tare" icon={WeightScale01Icon} />
      ),
      cell: ({ row }) => {
        const tare = Number(row.getValue("tare_weight"));
        return (
          <div className="flex items-baseline gap-1 font-mono text-xs">
            <span className="font-medium text-foreground">{tare.toLocaleString()}</span>
            <span className="text-2xs text-muted-foreground">kg</span>
          </div>
        );
      },
      meta: {
        title: "Tare",
        icon: WeightScale01Icon,
      },
    }),
    columnHelper.accessor((row) => row.in_entry.center.name, {
      id: "in_center",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="In Center" icon={Building01Icon} />
      ),
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs font-normal">
          {row.original.in_entry.center.name}
        </Badge>
      ),
      meta: {
        title: "In Center",
        icon: Building01Icon,
      },
      enableSorting: true,
    }),
    columnHelper.accessor((row) => row.out_entry.center.name, {
      id: "out_center",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Out Center" icon={Building01Icon} />
      ),
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs font-normal">
          {row.original.out_entry.center.name}
        </Badge>
      ),
      meta: {
        title: "Out Center",
        icon: Building01Icon,
      },
      enableSorting: true,
    }),
    columnHelper.accessor((row) => row.in_entry.customer?.name ?? "", {
      id: "in_customer",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="In Customer" icon={UserGroupIcon} />
      ),
      cell: ({ row }) => {
        const name = row.original.in_entry.customer?.name;
        if (!name) {
          return <span className="text-2xs text-muted-foreground italic">Unassigned</span>;
        }
        return <span className="text-xs font-medium text-foreground">{name}</span>;
      },
      meta: {
        title: "In Customer",
        icon: UserGroupIcon,
      },
      enableSorting: true,
    }),
    columnHelper.accessor((row) => row.out_entry.customer?.name ?? "", {
      id: "out_customer",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Out Customer" icon={UserGroupIcon} />
      ),
      cell: ({ row }) => {
        const name = row.original.out_entry.customer?.name;
        if (!name) {
          return <span className="text-2xs text-muted-foreground italic">Unassigned</span>;
        }
        return <span className="text-xs font-medium text-foreground">{name}</span>;
      },
      meta: {
        title: "Out Customer",
        icon: UserGroupIcon,
      },
      enableSorting: true,
    }),
    columnHelper.accessor((row) => row.in_entry.created_at, {
      id: "in_time",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="In Time" icon={Clock01Icon} />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDateTime(row.original.in_entry.created_at)}
        </span>
      ),
      meta: {
        title: "In Time",
        icon: Clock01Icon,
      },
      enableSorting: true,
    }),
    columnHelper.accessor((row) => row.out_entry.created_at, {
      id: "out_time",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Out Time" icon={Clock01Icon} />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDateTime(row.original.out_entry.created_at)}
        </span>
      ),
      meta: {
        title: "Out Time",
        icon: Clock01Icon,
      },
      enableSorting: true,
    }),
    columnHelper.display({
      id: "photos",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Photos" icon={Image01Icon} />
      ),
      cell: ({ row, table }) => {
        const inImages = row.original.in_entry.images;
        const outImages = row.original.out_entry.images;
        const allImages = [...inImages, ...outImages];
        const count = allImages.length;

        if (count === 0) {
          return <span className="text-2xs text-muted-foreground">0</span>;
        }

        const meta = table.options.meta as WeighmentsTableMeta | undefined;
        return (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() =>
              meta?.onViewPhotos?.(
                `Weighment #${row.original.id} Photos`,
                `${row.original.vehicle_number} • ${row.original.in_entry.center.name} ➔ ${row.original.out_entry.center.name}`,
                allImages,
              )
            }
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
    columnHelper.accessor("created_at", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created At" icon={Calendar01Icon} />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
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
