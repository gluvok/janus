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
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Building02Icon,
  FingerPrintIcon,
  Image01Icon,
  ScaleIcon,
  TruckIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import type { PhotoItem } from "@/components/photos-dialog";
import type { Entry } from "./types";

export interface EntriesTableMeta {
  onViewPhotos: (payload: {
    weighmentId: number;
    vehicleNumber: string;
    inCenter: { id: number; name: string };
    outCenter: { id: number; name: string } | null;
    images: PhotoItem[];
  }) => void;
}

const helper = createColumnHelper<DataTableFeatures, Entry>();

export const columns: ColumnDef<DataTableFeatures, Entry, any>[] = [
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
  helper.accessor((row) => row.weight, {
    id: "weight",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Scale Weight" icon={ScaleIcon} />
    ),
    cell: ({ row }) => (
      <div className="flex items-baseline gap-1 font-mono text-xs">
        <span className="font-bold text-foreground">
          {Number(row.original.weight).toLocaleString()}
        </span>
        <span className="text-2xs text-muted-foreground">kg</span>
      </div>
    ),
    meta: { title: "Scale Weight", icon: ScaleIcon },
  }),
  helper.accessor((row) => row.center_name, {
    id: "center_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Center" icon={Building02Icon} />
    ),
    cell: ({ row }) => (
      <Badge variant="secondary" className="text-xs font-normal">
        {row.original.center_name}
      </Badge>
    ),
    meta: { title: "Center", icon: Building02Icon },
  }),
  helper.accessor((row) => row.creator_name ?? "—", {
    id: "creator_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Operator" icon={UserIcon} />
    ),
    cell: ({ row }) => {
      const creatorName = row.original.creator_name;
      if (!creatorName) {
        return <span className="text-2xs text-muted-foreground italic">Automated</span>;
      }
      return <span className="text-xs font-medium text-foreground">{creatorName}</span>;
    },
    meta: { title: "Operator", icon: UserIcon },
    enableSorting: false,
  }),
  helper.display({
    id: "photos",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Photos" icon={Image01Icon} />
    ),
    cell: ({ row, table }) => {
      const images = row.original.images ?? [];
      const totalCount = images.length;

      if (totalCount === 0) {
        return <span className="text-2xs text-muted-foreground">0</span>;
      }

      const photos: PhotoItem[] = images.map((url) => ({ url, direction: "in" }));
      const meta = table.options.meta as EntriesTableMeta | undefined;

      return (
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() =>
            meta?.onViewPhotos({
              weighmentId: row.original.id,
              vehicleNumber: row.original.vehicle_number,
              inCenter: { id: row.original.center_id, name: row.original.center_name },
              outCenter: null,
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
  helper.accessor((row) => row.idempotency_key, {
    id: "idempotency_key",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Idempotency Key" icon={FingerPrintIcon} />
    ),
    cell: ({ row }) => (
      <span
        className="font-mono text-3xs text-muted-foreground max-w-28 truncate block"
        title={row.original.idempotency_key}
      >
        {row.original.idempotency_key}
      </span>
    ),
    meta: { title: "Idempotency Key", icon: FingerPrintIcon },
    enableSorting: false,
  }),
  createCreatedAtColumn(helper),
  createUpdatedAtColumn(helper),
  createCopyActionsColumn<Entry>(helper, ({ row }) => ({
    copyText: row.original.vehicle_number,
    copyLabel: "Copy Vehicle No.",
  })),
];
