"use client";

import type { ColumnDef, ColumnHelper, Row, RowData, Table } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions, type DataTableRowActionsProps } from "./data-table-row-actions";
import { formatDateTime } from "@/lib/utils";
import {
  AtIcon,
  Building01Icon,
  Building02Icon,
  Building03Icon,
  Calendar01Icon,
  Camera01Icon,
  Clock01Icon,
  ClockArrowDownIcon,
  ClockArrowUpIcon,
  ContainerTruck01Icon,
  HashtagIcon,
  Image01Icon,
  Layers01Icon,
  PackageOpenIcon,
  ScaleIcon,
  SecurityCheckIcon,
  TextFontIcon,
  TruckIcon,
  UserArrowLeftRightIcon,
  UserCheck01Icon,
  UserEdit01Icon,
  UserGroupIcon,
  WeightScale01Icon,
} from "@hugeicons/core-free-icons";
import type { DataTableFeatures } from "./data-table-features";

export interface ColumnMetaConfig {
  label: string;
  icon: unknown;
}

export const DEFAULT_COLUMN_METADATA: Record<string, ColumnMetaConfig> = {
  id: { label: "ID", icon: HashtagIcon },
  name: { label: "Name", icon: TextFontIcon },
  created_at: { label: "Created At", icon: Calendar01Icon },
  updated_at: { label: "Updated At", icon: Clock01Icon },
  vehicle_number: { label: "Vehicle No.", icon: TruckIcon },
  weight: { label: "Weight", icon: WeightScale01Icon },
  center: { label: "Center", icon: Building01Icon },
  customer: { label: "Customer", icon: UserGroupIcon },
  creator: { label: "Created By", icon: UserEdit01Icon },
  images: { label: "Photos", icon: Camera01Icon },
  photos: { label: "Photos", icon: Image01Icon },
  username: { label: "Username", icon: AtIcon },
  role: { label: "Role", icon: SecurityCheckIcon },
  type: { label: "Type", icon: Layers01Icon },
  net_weight: { label: "Net Weight", icon: ScaleIcon },
  gross_weight: { label: "Gross", icon: ContainerTruck01Icon },
  tare_weight: { label: "Tare", icon: PackageOpenIcon },
  in_center: { label: "In Center", icon: Building02Icon },
  out_center: { label: "Out Center", icon: Building03Icon },
  in_customer: { label: "In Customer", icon: UserCheck01Icon },
  out_customer: { label: "Out Customer", icon: UserArrowLeftRightIcon },
  in_time: { label: "In Time", icon: ClockArrowDownIcon },
  out_time: { label: "Out Time", icon: ClockArrowUpIcon },
};

export function createSelectColumn<TData extends RowData>(
  columnHelper: ColumnHelper<DataTableFeatures, TData>,
): ColumnDef<DataTableFeatures, TData, unknown> {
  return columnHelper.display({
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="size-4"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="size-4"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  });
}

export function createIdColumn<TData extends { id: number }>(
  columnHelper: ColumnHelper<DataTableFeatures, TData>,
) {
  const meta = DEFAULT_COLUMN_METADATA.id;
  return columnHelper.accessor((row) => row.id, {
    id: "id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={meta.label} icon={meta.icon} />
    ),
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
    meta: {
      title: meta.label,
      icon: meta.icon,
    },
  });
}

export function createCreatedAtColumn<TData extends { created_at: string }>(
  columnHelper: ColumnHelper<DataTableFeatures, TData>,
) {
  const meta = DEFAULT_COLUMN_METADATA.created_at;
  return columnHelper.accessor((row) => row.created_at, {
    id: "created_at",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={meta.label} icon={meta.icon} />
    ),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {formatDateTime(row.original.created_at)}
      </span>
    ),
    meta: {
      title: meta.label,
      icon: meta.icon,
    },
  });
}

export function createUpdatedAtColumn<TData extends { updated_at: string }>(
  columnHelper: ColumnHelper<DataTableFeatures, TData>,
) {
  const meta = DEFAULT_COLUMN_METADATA.updated_at;
  return columnHelper.accessor((row) => row.updated_at, {
    id: "updated_at",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={meta.label} icon={meta.icon} />
    ),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {formatDateTime(row.original.updated_at)}
      </span>
    ),
    meta: {
      title: meta.label,
      icon: meta.icon,
    },
    enableSorting: true,
  });
}

export function createNameColumn<TData extends { name: string }>(
  columnHelper: ColumnHelper<DataTableFeatures, TData>,
  options?: {
    title?: string;
    icon?: unknown;
  },
) {
  const defaultMeta = DEFAULT_COLUMN_METADATA.name;
  const title = options?.title ?? defaultMeta.label;
  const icon = options?.icon ?? defaultMeta.icon;

  return columnHelper.accessor((row) => row.name, {
    id: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title={title} icon={icon} />,
    cell: ({ row }) => <span className="font-medium text-xs">{row.original.name}</span>,
    meta: {
      title,
      icon,
    },
  });
}

export function createActionsColumn<TData extends RowData>(
  columnHelper: ColumnHelper<DataTableFeatures, TData>,
  getActionProps: (props: {
    row: Row<DataTableFeatures, TData>;
    table: Table<DataTableFeatures, TData>;
  }) => DataTableRowActionsProps | null,
) {
  return columnHelper.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row, table }) => {
      const actionProps = getActionProps({ row, table });
      if (!actionProps) return null;
      return <DataTableRowActions {...actionProps} />;
    },
    enableSorting: false,
    enableHiding: false,
  });
}
