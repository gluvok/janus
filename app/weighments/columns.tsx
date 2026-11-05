"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTableColumnHeader,
  createCreatedAtColumn,
  createIdColumn,
  createSelectColumn,
  createActionsColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import { formatDateTime } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Building02Icon,
  Building03Icon,
  ClockArrowDownIcon,
  ClockArrowUpIcon,
  ContainerTruck01Icon,
  Image01Icon,
  Layers01Icon,
  PackageOpenIcon,
  ScaleIcon,
  TruckIcon,
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
    createIdColumn(columnHelper),
    columnHelper.accessor("vehicle_number", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Vehicle No." icon={TruckIcon} />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs font-semibold text-foreground">
            {row.original.vehicle_number}
          </span>
          {row.original.in_detected_vehicle_number &&
            row.original.in_detected_vehicle_number !== row.original.vehicle_number && (
              <span className="font-mono text-3xs text-muted-foreground">
                In ANPR: {row.original.in_detected_vehicle_number}
              </span>
            )}
        </div>
      ),
      meta: {
        title: "Vehicle No.",
        icon: TruckIcon,
      },
    }),
    columnHelper.accessor("type", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" icon={Layers01Icon} />
      ),
      cell: ({ row }) => <WeighmentTypeBadge type={row.getValue("type")} />,
      meta: {
        title: "Type",
        icon: Layers01Icon,
      },
    }),
    columnHelper.accessor("net", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Net Weight" icon={ScaleIcon} />
      ),
      cell: ({ row }) => {
        const net = row.getValue("net") as number | null;
        if (net === null || net === undefined) {
          return <span className="text-2xs text-muted-foreground italic">-</span>;
        }
        return (
          <div className="flex items-baseline gap-1 font-mono text-xs">
            <span className="font-bold text-foreground">{net.toLocaleString()}</span>
            <span className="text-2xs text-muted-foreground">kg</span>
          </div>
        );
      },
      meta: {
        title: "Net Weight",
        icon: ScaleIcon,
      },
    }),
    columnHelper.accessor("gross", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Gross" icon={ContainerTruck01Icon} />
      ),
      cell: ({ row }) => {
        const gross = Number(row.getValue("gross"));
        return (
          <div className="flex items-baseline gap-1 font-mono text-xs">
            <span className="font-medium text-foreground">{gross.toLocaleString()}</span>
            <span className="text-2xs text-muted-foreground">kg</span>
          </div>
        );
      },
      meta: {
        title: "Gross",
        icon: ContainerTruck01Icon,
      },
    }),
    columnHelper.accessor("tare", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tare" icon={PackageOpenIcon} />
      ),
      cell: ({ row }) => {
        const tare = row.getValue("tare") as number | null;
        if (tare === null || tare === undefined) {
          return <span className="text-2xs text-muted-foreground italic">-</span>;
        }
        return (
          <div className="flex items-baseline gap-1 font-mono text-xs">
            <span className="font-medium text-foreground">{tare.toLocaleString()}</span>
            <span className="text-2xs text-muted-foreground">kg</span>
          </div>
        );
      },
      meta: {
        title: "Tare",
        icon: PackageOpenIcon,
      },
    }),
    columnHelper.accessor((row) => row.in_center.name, {
      id: "in_center",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="In Center" icon={Building02Icon} />
      ),
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs font-normal">
          {row.original.in_center.name}
        </Badge>
      ),
      meta: {
        title: "In Center",
        icon: Building02Icon,
      },
      enableSorting: false,
    }),
    columnHelper.accessor((row) => row.out_center?.name ?? "-", {
      id: "out_center",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Out Center" icon={Building03Icon} />
      ),
      cell: ({ row }) =>
        row.original.out_center ? (
          <Badge variant="secondary" className="text-xs font-normal">
            {row.original.out_center.name}
          </Badge>
        ) : (
          <span className="text-2xs text-muted-foreground italic">-</span>
        ),
      meta: {
        title: "Out Center",
        icon: Building03Icon,
      },
      enableSorting: false,
    }),
    columnHelper.accessor("in_time", {
      id: "in_time",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="In Time" icon={ClockArrowDownIcon} />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDateTime(row.original.in_time)}
        </span>
      ),
      meta: {
        title: "In Time",
        icon: ClockArrowDownIcon,
      },
    }),
    columnHelper.accessor("out_time", {
      id: "out_time",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Out Time" icon={ClockArrowUpIcon} />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {row.original.out_time ? formatDateTime(row.original.out_time) : "-"}
        </span>
      ),
      meta: {
        title: "Out Time",
        icon: ClockArrowUpIcon,
      },
    }),
    columnHelper.display({
      id: "photos",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Photos" icon={Image01Icon} />
      ),
      cell: ({ row, table }) => {
        const images = row.original.images ?? [];
        const count = images.length;

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
                `${row.original.vehicle_number} • ${row.original.in_center.name}${row.original.out_center ? ` ➔ ${row.original.out_center.name}` : ""}`,
                images,
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
    createCreatedAtColumn(columnHelper),
    createActionsColumn(columnHelper, ({ row }) => ({
      copyText: row.original.vehicle_number,
      copyLabel: "Copy Vehicle No.",
    })),
  ];

  return columnHelper.columns(allColumns);
}
