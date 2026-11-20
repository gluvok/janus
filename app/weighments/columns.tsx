"use client";

import { createColumnHelper } from "@tanstack/react-table";
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
  WeightScale01Icon,
} from "@hugeicons/core-free-icons";
import { WeighmentTypeBadge } from "@/components/weighment-type-badge";
import type { PhotoItem } from "@/components/photos-dialog";
import type { Weighment, WeighmentMode } from "./types";

const columnHelper = createColumnHelper<DataTableFeatures, Weighment>();

export interface WeighmentsTableMeta {
  onViewPhotos: (payload: {
    weighmentId: number;
    vehicleNumber: string;
    inCenter: { id: number; name: string };
    outCenter: { id: number; name: string } | null;
    images: PhotoItem[];
  }) => void;
  onDownloadReceipt?: (weighment: Weighment) => void;
}

/* -------------------------------------------------------------------------- */
/* Common Invariant Columns                                                   */
/* -------------------------------------------------------------------------- */

const typeColumn = columnHelper.accessor("type", {
  header: ({ column }) => (
    <DataTableColumnHeader column={column} title="Type" icon={Layers01Icon} />
  ),
  cell: ({ row }) => <WeighmentTypeBadge type={row.getValue("type")} />,
  meta: {
    title: "Type",
    icon: Layers01Icon,
  },
});

const netColumn = columnHelper.accessor("net", {
  header: ({ column }) => <DataTableColumnHeader column={column} title="Net" icon={ScaleIcon} />,
  cell: ({ row }) => {
    const hasBothWeights = row.original.in_weight !== null && row.original.out_weight !== null;
    if (!hasBothWeights) {
      return <span className="text-2xs text-muted-foreground italic">-</span>;
    }

    const net = row.getValue("net") as number | null;
    if (net === null) {
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
    title: "Net",
    icon: ScaleIcon,
  },
});

const grossColumn = columnHelper.accessor("gross", {
  header: ({ column }) => (
    <DataTableColumnHeader column={column} title="Gross" icon={ContainerTruck01Icon} />
  ),
  cell: ({ row }) => {
    const hasBothWeights = row.original.in_weight !== null && row.original.out_weight !== null;
    if (!hasBothWeights) {
      return <span className="text-2xs text-muted-foreground italic">-</span>;
    }

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
});

const tareColumn = columnHelper.accessor("tare", {
  header: ({ column }) => (
    <DataTableColumnHeader column={column} title="Tare" icon={PackageOpenIcon} />
  ),
  cell: ({ row }) => {
    const hasBothWeights = row.original.in_weight !== null && row.original.out_weight !== null;
    if (!hasBothWeights) {
      return <span className="text-2xs text-muted-foreground italic">-</span>;
    }

    const tare = row.getValue("tare") as number | null;
    if (tare === null) {
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
});

const inWeightColumn = columnHelper.accessor("in_weight", {
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
  meta: {
    title: "In Weight",
    icon: WeightScale01Icon,
  },
});

const outWeightColumn = columnHelper.accessor("out_weight", {
  header: ({ column }) => (
    <DataTableColumnHeader column={column} title="Out Weight" icon={WeightScale01Icon} />
  ),
  cell: ({ row }) => {
    const outWeight = row.original.out_weight;
    if (outWeight === null) {
      return <span className="text-2xs text-muted-foreground italic">-</span>;
    }
    return (
      <div className="flex items-baseline gap-1 font-mono text-xs">
        <span className="font-medium text-foreground">{Number(outWeight).toLocaleString()}</span>
        <span className="text-2xs text-muted-foreground">kg</span>
      </div>
    );
  },
  meta: {
    title: "Out Weight",
    icon: WeightScale01Icon,
  },
});

const inCenterColumn = columnHelper.accessor((row) => row.in_center.name, {
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
});

const outCenterColumn = columnHelper.accessor((row) => row.out_center?.name ?? "-", {
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
});

const inTimeColumn = columnHelper.accessor("in_time", {
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
});

const outTimeColumn = columnHelper.accessor("out_time", {
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
});

const photosColumn = columnHelper.display({
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
  meta: {
    title: "Photos",
    icon: Image01Icon,
  },
  enableSorting: false,
});

const actionsColumn = createCopyActionsColumn<Weighment>(columnHelper, ({ row, table }) => {
  const meta = table.options.meta as WeighmentsTableMeta | undefined;
  const isCompleted = row.original.type !== "pending";

  return {
    copyText: row.original.vehicle_number,
    copyLabel: "Copy Vehicle No.",
    onDownloadReceipt: isCompleted ? () => meta?.onDownloadReceipt?.(row.original) : undefined,
    receiptLabel: "Receipt",
  };
});

/* -------------------------------------------------------------------------- */
/* Specialized Columns (Automatic vs. Manual)                                 */
/* -------------------------------------------------------------------------- */

const automaticVehicleNumberColumn = columnHelper.accessor("vehicle_number", {
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
});

const manualVehicleNumberColumn = columnHelper.accessor("vehicle_number", {
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
});

const operatorColumn = columnHelper.accessor(
  (row) => row.in_creator?.name ?? row.out_creator?.name ?? "-",
  {
    id: "operator",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Operator" icon={UserIcon} />
    ),
    cell: ({ row }) => {
      const inCreator = row.original.in_creator;
      const outCreator = row.original.out_creator;

      if (!inCreator && !outCreator) {
        return <span className="text-2xs text-muted-foreground italic">-</span>;
      }

      if (inCreator && outCreator && inCreator.id !== outCreator.id) {
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-foreground">In: {inCreator.name}</span>
            <span className="text-2xs text-muted-foreground">Out: {outCreator.name}</span>
          </div>
        );
      }

      const creator = inCreator ?? outCreator;
      return <span className="text-xs font-medium text-foreground">{creator?.name}</span>;
    },
    meta: {
      title: "Operator",
      icon: UserIcon,
    },
    enableSorting: false,
  },
);

/* -------------------------------------------------------------------------- */
/* Column Builders & Declarative Registry                                     */
/* -------------------------------------------------------------------------- */

export function getAutomaticWeighmentColumns() {
  return columnHelper.columns([
    createSelectColumn(columnHelper),
    createIdColumn(columnHelper),
    automaticVehicleNumberColumn,
    typeColumn,
    netColumn,
    grossColumn,
    tareColumn,
    inWeightColumn,
    outWeightColumn,
    inCenterColumn,
    outCenterColumn,
    inTimeColumn,
    outTimeColumn,
    photosColumn,
    createCreatedAtColumn(columnHelper),
    createUpdatedAtColumn(columnHelper),
    actionsColumn,
  ]);
}

export function getManualWeighmentColumns() {
  return columnHelper.columns([
    createSelectColumn(columnHelper),
    createIdColumn(columnHelper),
    manualVehicleNumberColumn,
    typeColumn,
    netColumn,
    grossColumn,
    tareColumn,
    inWeightColumn,
    outWeightColumn,
    inCenterColumn,
    outCenterColumn,
    operatorColumn,
    inTimeColumn,
    outTimeColumn,
    photosColumn,
    createCreatedAtColumn(columnHelper),
    createUpdatedAtColumn(columnHelper),
    actionsColumn,
  ]);
}

export const WEIGHMENT_COLUMNS: Record<
  WeighmentMode,
  () => ReturnType<typeof columnHelper.columns>
> = {
  automatic: getAutomaticWeighmentColumns,
  manual: getManualWeighmentColumns,
};

export function getWeighmentColumns(mode: WeighmentMode) {
  return WEIGHMENT_COLUMNS[mode]();
}
