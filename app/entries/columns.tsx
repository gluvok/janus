"use client";

import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTableColumnHeader,
  createCreatedAtColumn,
  createIdColumn,
  createSelectColumn,
  createUpdatedAtColumn,
  createActionsColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Building01Icon,
  Camera01Icon,
  TruckIcon,
  UserEdit01Icon,
  UserGroupIcon,
  WeightScale01Icon,
} from "@hugeicons/core-free-icons";
import { type Entry, type EntryMode, isManualEntry } from "./types";

interface EntriesTableMeta {
  onViewPhotos?: (entry: Entry) => void;
  onEditEntry?: (entry: Entry) => void;
  onDeleteEntry?: (entry: Entry) => void;
}

const columnHelper = createColumnHelper<DataTableFeatures, Entry>();

const MODE_SPECIFIC_COLUMNS: Record<EntryMode, () => ColumnDef<DataTableFeatures, Entry, any>[]> = {
  automatic: () => [],
  manual: () => [
    columnHelper.accessor((row) => (isManualEntry(row) ? row.creator_id : undefined), {
      id: "creator",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Creator" icon={UserEdit01Icon} />
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
        icon: UserEdit01Icon,
      },
      enableSorting: true,
    }),
  ],
};

const MODE_ROW_ACTION_RESOLVERS: Record<
  EntryMode,
  (
    entry: Entry,
    meta?: EntriesTableMeta,
  ) => {
    copyText: string;
    copyLabel: string;
    onEdit?: () => void;
    onDelete?: () => void;
    deleteLabel?: string;
  }
> = {
  automatic: (entry, meta) => {
    const canEdit =
      !isManualEntry(entry) &&
      (entry.vehicle_number === entry.detected_vehicle_number || entry.customer_id === null);

    return {
      copyText: entry.vehicle_number,
      copyLabel: "Copy Vehicle No.",
      onEdit: canEdit && meta?.onEditEntry ? () => meta.onEditEntry!(entry) : undefined,
      onDelete: meta?.onDeleteEntry ? () => meta.onDeleteEntry!(entry) : undefined,
      deleteLabel: "Delete Entry",
    };
  },
  manual: (entry, meta) => ({
    copyText: entry.vehicle_number,
    copyLabel: "Copy Vehicle No.",
    onDelete: meta?.onDeleteEntry ? () => meta.onDeleteEntry!(entry) : undefined,
    deleteLabel: "Delete Entry",
  }),
};

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
    ...MODE_SPECIFIC_COLUMNS[mode](),
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
        <DataTableColumnHeader column={column} title="Photos" icon={Camera01Icon} />
      ),
      cell: ({ row, table }) => {
        const count = row.original.images?.length ?? 0;
        if (count === 0) {
          return <span className="text-2xs text-muted-foreground">0</span>;
        }
        const meta = table.options.meta as EntriesTableMeta | undefined;
        return (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => meta?.onViewPhotos?.(row.original)}
            className="h-5 gap-1 rounded-full px-2 py-0 text-2xs text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer"
            title={`View ${count} photo${count > 1 ? "s" : ""}`}
          >
            <HugeiconsIcon icon={Camera01Icon} className="size-3" />
            <span>{count}</span>
          </Button>
        );
      },
      meta: {
        title: "Photos",
        icon: Camera01Icon,
      },
      enableSorting: false,
    }),
    createCreatedAtColumn(columnHelper),
    createUpdatedAtColumn(columnHelper),
    createActionsColumn(columnHelper, ({ row, table }) => {
      const meta = table.options.meta as EntriesTableMeta | undefined;
      return MODE_ROW_ACTION_RESOLVERS[mode](row.original, meta);
    }),
  ];

  return columnHelper.columns(allColumns);
}

export const columns = getColumns("automatic");
