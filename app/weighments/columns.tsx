"use client";

import { createColumnHelper, type ColumnDef, type ColumnHelper } from "@tanstack/react-table";
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
  UserIcon,
  WeightIcon,
  WeightScale01Icon,
} from "@hugeicons/core-free-icons";
import { WeighmentTypeBadge } from "@/components/weighment-type-badge";
import type { PhotoItem } from "@/components/photos-dialog";
import type {
  AutomaticWeighment,
  AutomaticWeighmentType,
  ManualWeighment,
  WeighmentCenter,
} from "./types";

export interface WeighmentsTableMeta<TWeighment> {
  onViewPhotos: (payload: {
    weighmentId: number;
    vehicleNumber: string;
    inCenter: { id: number; name: string };
    outCenter: { id: number; name: string } | null;
    images: PhotoItem[];
  }) => void;
  onDownloadPdf?: (weighment: TWeighment) => void;
  downloadingId?: number | null;
}

export type AutomaticWeighmentsTableMeta = WeighmentsTableMeta<AutomaticWeighment>;
export type ManualWeighmentsTableMeta = WeighmentsTableMeta<ManualWeighment>;

export interface BaseWeighmentRow {
  id: number;
  vehicle_number: string;
  type: AutomaticWeighmentType;
  gross: number;
  tare: number | null;
  net: number | null;
  in_weight: number;
  out_weight: number | null;
  in_center: WeighmentCenter;
  out_center: WeighmentCenter | null;
  in_time: string;
  out_time: string | null;
  in_images: string[];
  out_images: string[];
  created_at: string;
  updated_at: string;
}

export function createLeadingWeighmentColumns<TData extends BaseWeighmentRow>(
  helper: ColumnHelper<DataTableFeatures, TData>,
): ColumnDef<DataTableFeatures, TData, any>[] {
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
      cell: ({ row }) => {
        const net = row.original.net;
        if (net === null || net === undefined) {
          return <span className="text-2xs text-muted-foreground italic">-</span>;
        }
        return (
          <div className="flex items-baseline gap-1 font-mono text-xs">
            <span className="font-bold text-foreground">{Number(net).toLocaleString()}</span>
            <span className="text-2xs text-muted-foreground">kg</span>
          </div>
        );
      },
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
      cell: ({ row }) => {
        const tare = row.original.tare;
        if (tare === null || tare === undefined) {
          return <span className="text-2xs text-muted-foreground italic">-</span>;
        }
        return (
          <div className="flex items-baseline gap-1 font-mono text-xs">
            <span className="font-medium text-foreground">{Number(tare).toLocaleString()}</span>
            <span className="text-2xs text-muted-foreground">kg</span>
          </div>
        );
      },
      meta: { title: "Tare", icon: PackageOpenIcon },
    }),
    helper.accessor((row) => row.in_weight, {
      id: "in_weight",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="In Weight" icon={WeightScale01Icon} />
      ),
      cell: ({ row }) => (
        <div className="flex items-baseline gap-1 font-mono text-xs">
          <span className="font-medium text-foreground">
            {Number(row.original.in_weight).toLocaleString()}
          </span>
          <span className="text-2xs text-muted-foreground">kg</span>
        </div>
      ),
      meta: { title: "In Weight", icon: WeightScale01Icon },
    }),
    helper.accessor((row) => row.out_weight, {
      id: "out_weight",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Out Weight" icon={WeightIcon} />
      ),
      cell: ({ row }) => {
        const outWeight = row.original.out_weight;
        if (outWeight === null || outWeight === undefined) {
          return <span className="text-2xs text-muted-foreground italic">-</span>;
        }
        return (
          <div className="flex items-baseline gap-1 font-mono text-xs">
            <span className="font-medium text-foreground">
              {Number(outWeight).toLocaleString()}
            </span>
            <span className="text-2xs text-muted-foreground">kg</span>
          </div>
        );
      },
      meta: { title: "Out Weight", icon: WeightIcon },
    }),
    helper.accessor((row) => row.in_center.name, {
      id: "in_center",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="In Center" icon={Building02Icon} />
      ),
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs font-normal">
          {row.original.in_center.name}
        </Badge>
      ),
      meta: { title: "In Center", icon: Building02Icon },
      enableSorting: false,
    }),
    helper.accessor((row) => row.out_center?.name ?? "-", {
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
      meta: { title: "Out Center", icon: Building03Icon },
      enableSorting: false,
    }),
  ];
}

export function createTrailingWeighmentColumns<TData extends BaseWeighmentRow>(
  helper: ColumnHelper<DataTableFeatures, TData>,
): ColumnDef<DataTableFeatures, TData, any>[] {
  return [
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
          {row.original.out_time ? formatDateTime(row.original.out_time) : "-"}
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
        const inImages = row.original.in_images;
        const outImages = row.original.out_images;
        const totalCount = inImages.length + outImages.length;

        if (totalCount === 0) {
          return <span className="text-2xs text-muted-foreground">0</span>;
        }

        const inPhotos: PhotoItem[] = inImages.map((url) => ({ url, direction: "in" }));
        const outPhotos: PhotoItem[] = outImages.map((url) => ({ url, direction: "out" }));
        const photos: PhotoItem[] = [...inPhotos, ...outPhotos];

        const meta = table.options.meta as WeighmentsTableMeta<TData> | undefined;
        return (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() =>
              meta?.onViewPhotos({
                weighmentId: row.original.id,
                vehicleNumber: row.original.vehicle_number,
                inCenter: row.original.in_center,
                outCenter: row.original.out_center,
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
  ];
}

export function createManualCreatorColumn(
  helper: ColumnHelper<DataTableFeatures, ManualWeighment>,
): ColumnDef<DataTableFeatures, ManualWeighment, any> {
  return helper.accessor((row) => row.creator.name, {
    id: "creator",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Creator" icon={UserIcon} />
    ),
    cell: ({ row }) => (
      <span className="text-xs font-medium text-foreground">{row.original.creator.name}</span>
    ),
    meta: { title: "Creator", icon: UserIcon },
    enableSorting: false,
  });
}

export function createAutomaticActionsColumn(
  helper: ColumnHelper<DataTableFeatures, AutomaticWeighment>,
): ColumnDef<DataTableFeatures, AutomaticWeighment, any> {
  return createCopyActionsColumn<AutomaticWeighment>(helper, ({ row, table }) => {
    const meta = table.options.meta as AutomaticWeighmentsTableMeta | undefined;
    const isCompleted = row.original.type !== "pending";

    return {
      copyText: row.original.vehicle_number,
      copyLabel: "Copy Vehicle No.",
      onDownloadPdf: isCompleted ? () => meta?.onDownloadPdf?.(row.original) : undefined,
      isDownloadingPdf: meta?.downloadingId === row.original.id,
    };
  });
}

export function createManualActionsColumn(
  helper: ColumnHelper<DataTableFeatures, ManualWeighment>,
): ColumnDef<DataTableFeatures, ManualWeighment, any> {
  return createCopyActionsColumn<ManualWeighment>(helper, ({ row, table }) => {
    const meta = table.options.meta as ManualWeighmentsTableMeta | undefined;

    return {
      copyText: row.original.vehicle_number,
      copyLabel: "Copy Vehicle No.",
      onDownloadPdf: () => meta?.onDownloadPdf?.(row.original),
      isDownloadingPdf: meta?.downloadingId === row.original.id,
    };
  });
}

export function getAutomaticWeighmentColumns(): ColumnDef<
  DataTableFeatures,
  AutomaticWeighment,
  any
>[] {
  const helper = createColumnHelper<DataTableFeatures, AutomaticWeighment>();
  return [
    ...createLeadingWeighmentColumns(helper),
    ...createTrailingWeighmentColumns(helper),
    createAutomaticActionsColumn(helper),
  ];
}

export function getManualWeighmentColumns(): ColumnDef<DataTableFeatures, ManualWeighment, any>[] {
  const helper = createColumnHelper<DataTableFeatures, ManualWeighment>();
  return [
    ...createLeadingWeighmentColumns(helper),
    createManualCreatorColumn(helper),
    ...createTrailingWeighmentColumns(helper),
    createManualActionsColumn(helper),
  ];
}
