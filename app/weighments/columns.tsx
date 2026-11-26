"use client";

import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_COLUMN_METADATA,
  DataTableColumnHeader,
  createCreatedAtColumn,
  createUpdatedAtColumn,
  createIdColumn,
  createSelectColumn,
  createCopyActionsColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import { CopyRowAction } from "@/components/data-table/row-actions";
import { appIcons } from "@/lib/icons";
import { formatDateTime, cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AtIcon,
  Building02Icon,
  Building03Icon,
  ClockArrowDownIcon,
  ClockArrowUpIcon,
  Image01Icon,
  Layers01Icon,
  PackageOpenIcon,
  ScaleIcon,
  SecurityCheckIcon,
  TruckIcon,
  UserArrowLeftRightIcon,
  UserCheck01Icon,
  WeightScale01Icon,
} from "@hugeicons/core-free-icons";
import { RoleBadge } from "@/components/role-badge";
import { WeighmentTypeBadge } from "@/components/weighment-type-badge";
import type { PhotoItem } from "@/components/photos-dialog";
import type { EntityMode } from "@/stores/use-mode-store";
import type { UserRole } from "@/app/users/types";
import type { ManualWeighment, Weighment } from "./types";

function isManualWeighment(row: Weighment): row is ManualWeighment {
  return "in_creator_id" in row;
}

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
  onCorrectPlate?: (weighment: Weighment) => void;
  onDelete?: (weighment: Weighment) => void;
}

type ColumnIcon = Parameters<typeof HugeiconsIcon>[0]["icon"];

const helper = createColumnHelper<DataTableFeatures, Weighment>();

function createWeightColumn(
  id: "net" | "gross" | "tare",
  title: string,
  icon: ColumnIcon,
  isBold = false,
): ColumnDef<DataTableFeatures, Weighment, number> {
  return helper.accessor((row) => row[id], {
    id,
    header: ({ column }) => <DataTableColumnHeader column={column} title={title} icon={icon} />,
    cell: ({ row }) => (
      <div className="flex items-baseline gap-1 font-mono text-xs">
        <span className={cn("text-foreground", isBold ? "font-bold" : "font-medium")}>
          {Number(row.original[id]).toLocaleString()}
        </span>
        <span className="text-2xs text-muted-foreground">kg</span>
      </div>
    ),
    meta: { title, icon },
  });
}

function createCenterColumn(
  id: "in_center_name" | "out_center_name",
  idField: "in_center_id" | "out_center_id",
  title: string,
  icon: ColumnIcon,
): ColumnDef<DataTableFeatures, Weighment, string> {
  return helper.accessor((row) => row[id], {
    id,
    header: ({ column }) => <DataTableColumnHeader column={column} title={title} icon={icon} />,
    cell: ({ row }) => (
      <Badge variant="secondary" className="text-xs font-normal gap-1">
        <span className="font-mono text-muted-foreground">#{row.original[idField]}</span>
        <span>{row.original[id]}</span>
      </Badge>
    ),
    meta: { title, icon },
  });
}

function createTimeColumn(
  id: "in_time" | "out_time",
  entryIdField: "in_entry_id" | "out_entry_id",
  title: string,
  icon: ColumnIcon,
): ColumnDef<DataTableFeatures, Weighment, string> {
  return helper.accessor((row) => row[id], {
    id,
    header: ({ column }) => <DataTableColumnHeader column={column} title={title} icon={icon} />,
    cell: ({ row }) => (
      <div className="flex items-baseline gap-1.5 whitespace-nowrap text-xs">
        <span className="text-muted-foreground">{formatDateTime(row.original[id])}</span>
        <span className="font-mono text-2xs text-muted-foreground/75">
          #{row.original[entryIdField]}
        </span>
      </div>
    ),
    meta: { title, icon },
  });
}

function createNumericIdColumn(
  id: string,
  title: string,
  icon: ColumnIcon,
  accessor: (row: Weighment) => number | undefined,
): ColumnDef<DataTableFeatures, Weighment, number | undefined> {
  return helper.accessor(accessor, {
    id,
    header: ({ column }) => <DataTableColumnHeader column={column} title={title} icon={icon} />,
    cell: ({ getValue }) => {
      const val = getValue();
      return val !== undefined ? <span className="font-mono text-xs">{val}</span> : null;
    },
    meta: { title, icon },
  });
}

function createCreatorColumn(
  id: "in_creator_name" | "out_creator_name",
  idField: "in_creator_id" | "out_creator_id",
  title: string,
  icon: ColumnIcon,
): ColumnDef<DataTableFeatures, Weighment, string> {
  return helper.accessor((row) => (isManualWeighment(row) ? row[id] : ""), {
    id,
    header: ({ column }) => <DataTableColumnHeader column={column} title={title} icon={icon} />,
    cell: ({ row }) => {
      const record = row.original;
      if (!isManualWeighment(record)) return null;
      return (
        <div className="flex items-baseline gap-1.5 whitespace-nowrap text-xs">
          <span className="font-mono text-2xs text-muted-foreground">#{record[idField]}</span>
          <span className="font-medium text-foreground">{record[id]}</span>
        </div>
      );
    },
    meta: { title, icon },
  });
}

function createCreatorUsernameColumn(
  id: "in_creator_username" | "out_creator_username",
  title: string,
): ColumnDef<DataTableFeatures, Weighment, string> {
  return helper.accessor((row) => (isManualWeighment(row) ? row[id] : ""), {
    id,
    header: ({ column }) => <DataTableColumnHeader column={column} title={title} icon={AtIcon} />,
    cell: ({ row }) => {
      const record = row.original;
      if (!isManualWeighment(record)) return null;
      return <span className="font-mono text-xs font-medium text-foreground">{record[id]}</span>;
    },
    meta: { title, icon: AtIcon },
  });
}

function createCreatorRoleColumn(
  id: "in_creator_role" | "out_creator_role",
  title: string,
): ColumnDef<DataTableFeatures, Weighment, UserRole | undefined> {
  return helper.accessor((row) => (isManualWeighment(row) ? row[id] : undefined), {
    id,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={title} icon={SecurityCheckIcon} />
    ),
    cell: ({ row }) => {
      const record = row.original;
      if (!isManualWeighment(record)) return null;
      return <RoleBadge role={record[id]} />;
    },
    meta: { title, icon: SecurityCheckIcon },
  });
}

const BASE_PRE_COLUMNS: ColumnDef<DataTableFeatures, Weighment, any>[] = [
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
  createWeightColumn("net", "Net", ScaleIcon, true),
  createWeightColumn("gross", "Gross", appIcons.gross),
  createWeightColumn("tare", "Tare", PackageOpenIcon),
  createCenterColumn("in_center_name", "in_center_id", "In Center", Building02Icon),
  createCenterColumn("out_center_name", "out_center_id", "Out Center", Building03Icon),
  createTimeColumn("in_time", "in_entry_id", "In Time", ClockArrowDownIcon),
  createTimeColumn("out_time", "out_entry_id", "Out Time", ClockArrowUpIcon),
];

const MANUAL_VISIBLE_COLUMNS: ColumnDef<DataTableFeatures, Weighment, any>[] = [
  createCreatorColumn(
    "in_creator_name",
    "in_creator_id",
    DEFAULT_COLUMN_METADATA.in_creator_name.label,
    UserCheck01Icon,
  ),
  createCreatorColumn(
    "out_creator_name",
    "out_creator_id",
    DEFAULT_COLUMN_METADATA.out_creator_name.label,
    UserArrowLeftRightIcon,
  ),
];

const PHOTOS_COLUMN: ColumnDef<DataTableFeatures, Weighment, any> = helper.display({
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

    const photos: PhotoItem[] = [
      ...inImages.map((url) => ({ url, direction: "in" as const })),
      ...outImages.map((url) => ({ url, direction: "out" as const })),
    ];

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
});

const BASE_HIDDEN_COLUMNS: ColumnDef<DataTableFeatures, Weighment, any>[] = [
  createNumericIdColumn("in_entry_id", "In Entry ID", WeightScale01Icon, (r) => r.in_entry_id),
  createNumericIdColumn("out_entry_id", "Out Entry ID", WeightScale01Icon, (r) => r.out_entry_id),
  createNumericIdColumn("in_center_id", "In Center ID", Building02Icon, (r) => r.in_center_id),
  createNumericIdColumn("out_center_id", "Out Center ID", Building03Icon, (r) => r.out_center_id),
];

const MANUAL_HIDDEN_COLUMNS: ColumnDef<DataTableFeatures, Weighment, any>[] = [
  createNumericIdColumn(
    "in_creator_id",
    DEFAULT_COLUMN_METADATA.in_creator_id.label,
    UserCheck01Icon,
    (r) => ("in_creator_id" in r ? r.in_creator_id : undefined),
  ),
  createCreatorUsernameColumn(
    "in_creator_username",
    DEFAULT_COLUMN_METADATA.in_creator_username.label,
  ),
  createCreatorRoleColumn("in_creator_role", DEFAULT_COLUMN_METADATA.in_creator_role.label),
  createNumericIdColumn(
    "out_creator_id",
    DEFAULT_COLUMN_METADATA.out_creator_id.label,
    UserArrowLeftRightIcon,
    (r) => ("out_creator_id" in r ? r.out_creator_id : undefined),
  ),
  createCreatorUsernameColumn(
    "out_creator_username",
    DEFAULT_COLUMN_METADATA.out_creator_username.label,
  ),
  createCreatorRoleColumn("out_creator_role", DEFAULT_COLUMN_METADATA.out_creator_role.label),
];

const BASE_POST_COLUMNS: ColumnDef<DataTableFeatures, Weighment, any>[] = [
  createCreatedAtColumn(helper),
  createUpdatedAtColumn(helper),
];

function createAutomaticActionsColumn(): ColumnDef<DataTableFeatures, Weighment, any> {
  return helper.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row, table }) => {
      const meta = table.options.meta as WeighmentsTableMeta | undefined;
      return (
        <div className="flex items-center justify-end">
          <CopyRowAction
            copyText={row.original.vehicle_number}
            copyLabel="Copy Vehicle No."
            onDownloadPdf={() => meta?.onDownloadPdf?.(row.original)}
            isDownloadingPdf={meta?.downloadingId === row.original.id}
            onEdit={() => meta?.onCorrectPlate?.(row.original)}
            editLabel="Correct Plate"
            onDelete={() => meta?.onDelete?.(row.original)}
            deleteLabel="Delete"
          />
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
  });
}

const MANUAL_ACTIONS_COLUMN = createCopyActionsColumn<Weighment>(helper, ({ row, table }) => {
  const meta = table.options.meta as WeighmentsTableMeta | undefined;
  return {
    copyText: row.original.vehicle_number,
    copyLabel: "Copy Vehicle No.",
    onDownloadPdf: () => meta?.onDownloadPdf?.(row.original),
    isDownloadingPdf: meta?.downloadingId === row.original.id,
  };
});

export function getWeighmentColumns(
  mode: EntityMode,
): ColumnDef<DataTableFeatures, Weighment, any>[] {
  return [
    ...BASE_PRE_COLUMNS,
    ...(mode === "manual" ? MANUAL_VISIBLE_COLUMNS : []),
    PHOTOS_COLUMN,
    ...BASE_HIDDEN_COLUMNS,
    ...(mode === "manual" ? MANUAL_HIDDEN_COLUMNS : []),
    ...BASE_POST_COLUMNS,
    mode === "automatic" ? createAutomaticActionsColumn() : MANUAL_ACTIONS_COLUMN,
  ];
}
