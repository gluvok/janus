"use client";

import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTableColumnHeader,
  createCreatedAtColumn,
  createUpdatedAtColumn,
  createIdColumn,
  createSelectColumn,
  createCopyActionsColumn,
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
import type { PhotoItem } from "@/components/photos-dialog";
import type { Weighment } from "./types";

export interface WeighmentsTableMeta {
  onViewPhotos: (payload: {
    weighmentId: number;
    vehicleNumber: string;
    inCenter: { id: number; name: string };
    outCenter: { id: number; name: string } | null;
    images: PhotoItem[];
  }) => void;
  onDownloadPdf?: (weighment: Weighment) => void;
  downloadingId?: number | null;
}

const helper = createColumnHelper<DataTableFeatures, Weighment>();

export function getWeighmentColumns(): ColumnDef<DataTableFeatures, Weighment, any>[] {
  return [
    createSelectColumn(helper),
    createIdColumn(helper),
    helper.accessor((row) => row.vehicle_number, {
      id: "vehicle_number",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Vehicle No." icon={TruckIcon} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-foreground">
          {row.original.vehicle_number}
        </span>
      ),
      meta: { title: "Vehicle No.", icon: TruckIcon },
    }),
    helper.accessor((row) => row.type, {
      id: "type",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" icon={Layers01Icon} />
      ),
      cell: ({ row }) => <WeighmentTypeBadge type={row.original.type} />,
      meta: { title: "Type", icon: Layers01Icon },
    }),
    helper.accessor((row) => row.net, {
      id: "net",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Net" icon={ScaleIcon} />
      ),
      cell: ({ row }) => (
        <div className="flex items-baseline gap-1 font-mono text-xs">
          <span className="font-bold text-foreground">
            {Number(row.original.net).toLocaleString()}
          </span>
          <span className="text-2xs text-muted-foreground">kg</span>
        </div>
      ),
      meta: { title: "Net", icon: ScaleIcon },
    }),
    helper.accessor((row) => row.gross, {
      id: "gross",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Gross" icon={ContainerTruck01Icon} />
      ),
      cell: ({ row }) => (
        <div className="flex items-baseline gap-1 font-mono text-xs">
          <span className="font-medium text-foreground">
            {Number(row.original.gross).toLocaleString()}
          </span>
          <span className="text-2xs text-muted-foreground">kg</span>
        </div>
      ),
      meta: { title: "Gross", icon: ContainerTruck01Icon },
    }),
    helper.accessor((row) => row.tare, {
      id: "tare",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tare" icon={PackageOpenIcon} />
      ),
      cell: ({ row }) => (
        <div className="flex items-baseline gap-1 font-mono text-xs">
          <span className="font-medium text-foreground">
            {Number(row.original.tare).toLocaleString()}
          </span>
          <span className="text-2xs text-muted-foreground">kg</span>
        </div>
      ),
      meta: { title: "Tare", icon: PackageOpenIcon },
    }),
    helper.accessor((row) => row.in_center_name, {
      id: "in_center",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="In Center" icon={Building02Icon} />
      ),
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs font-normal">
          {row.original.in_center_name}
        </Badge>
      ),
      meta: { title: "In Center", icon: Building02Icon },
      enableSorting: false,
    }),
    helper.accessor((row) => row.out_center_name, {
      id: "out_center",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Out Center" icon={Building03Icon} />
      ),
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs font-normal">
          {row.original.out_center_name}
        </Badge>
      ),
      meta: { title: "Out Center", icon: Building03Icon },
      enableSorting: false,
    }),
    helper.accessor((row) => row.in_time, {
      id: "in_time",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="In Time" icon={ClockArrowDownIcon} />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDateTime(row.original.in_time)}
        </span>
      ),
      meta: { title: "In Time", icon: ClockArrowDownIcon },
    }),
    helper.accessor((row) => row.out_time, {
      id: "out_time",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Out Time" icon={ClockArrowUpIcon} />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDateTime(row.original.out_time)}
        </span>
      ),
      meta: { title: "Out Time", icon: ClockArrowUpIcon },
    }),
    helper.display({
      id: "photos",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Photos" icon={Image01Icon} />
      ),
      cell: ({ row, table }) => {
        const inImages = row.original.in_images ?? [];
        const outImages = row.original.out_images ?? [];
        const totalCount = inImages.length + outImages.length;

        if (totalCount === 0) {
          return <span className="text-2xs text-muted-foreground">0</span>;
        }

        const inPhotos: PhotoItem[] = inImages.map((url) => ({ url, direction: "in" }));
        const outPhotos: PhotoItem[] = outImages.map((url) => ({ url, direction: "out" }));
        const photos: PhotoItem[] = [...inPhotos, ...outPhotos];

        const meta = table.options.meta as WeighmentsTableMeta | undefined;
        return (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() =>
              meta?.onViewPhotos({
                weighmentId: row.original.id,
                vehicleNumber: row.original.vehicle_number,
                inCenter: { id: row.original.in_center_id, name: row.original.in_center_name },
                outCenter: { id: row.original.out_center_id, name: row.original.out_center_name },
                images: photos,
              })
            }
            className="h-5 gap-1 rounded-full px-2 py-0 text-2xs text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer"
            title={`View ${totalCount} photo${totalCount > 1 ? "s" : ""}`}
          >
            <HugeiconsIcon icon={Image01Icon} className="size-3" />
            <span>{totalCount}</span>
          </Button>
        );
      },
      meta: { title: "Photos", icon: Image01Icon },
      enableSorting: false,
    }),
    createCreatedAtColumn(helper),
    createUpdatedAtColumn(helper),
    createCopyActionsColumn<Weighment>(helper, ({ row, table }) => {
      const meta = table.options.meta as WeighmentsTableMeta | undefined;
      return {
        copyText: row.original.vehicle_number,
        copyLabel: "Copy Vehicle No.",
        onDownloadPdf: () => meta?.onDownloadPdf?.(row.original),
        isDownloadingPdf: meta?.downloadingId === row.original.id,
      };
    }),
  ];
}
