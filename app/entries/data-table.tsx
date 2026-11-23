"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  DataTableContent,
  DataTablePagination,
  DataTableToolbar,
  useDataTable,
  endpointFetcher,
  type FacetedFilterOption,
  type DataTableFilterConfig,
} from "@/components/data-table";
import { Building02Icon } from "@hugeicons/core-free-icons";
import { appIcons } from "@/lib/icons";
import { PhotosDialog, type PhotoItem } from "@/components/photos-dialog";
import type { Center } from "@/app/centers/types";
import { columns, type EntriesTableMeta } from "./columns";
import type { Entry } from "./types";

interface PhotosDialogState {
  open: boolean;
  weighmentId: number;
  vehicleNumber: string;
  inCenter: { id: number; name: string };
  outCenter: { id: number; name: string } | null;
  images: PhotoItem[];
}

export function EntriesDataTable() {
  const [centerOptions, setCenterOptions] = useState<FacetedFilterOption[]>([
    { label: "All Centers", value: "all", icon: appIcons.centers },
  ]);

  const [photosDialogState, setPhotosDialogState] = useState<PhotosDialogState>({
    open: false,
    weighmentId: 0,
    vehicleNumber: "",
    inCenter: { id: 0, name: "" },
    outCenter: null,
    images: [],
  });

  useEffect(() => {
    async function loadCenters() {
      try {
        const res = await axios.get<{ data: Center[] }>("/api/centers?all=true&sort=name.asc");
        const centers = res.data.data ?? [];
        setCenterOptions([
          { label: "All Centers", value: "all", icon: appIcons.centers },
          ...centers.map((c) => ({
            idPrefix: `#${c.id}`,
            label: c.name,
            value: String(c.id),
          })),
        ]);
      } catch {
        // Non-fatal if centers fail to load
      }
    }
    loadCenters();
  }, []);

  const tableMeta: EntriesTableMeta = useMemo(
    () => ({
      onViewPhotos: (payload) => setPhotosDialogState({ open: true, ...payload }),
    }),
    [],
  );

  const dataTable = useDataTable<Entry>({
    tableId: "entries",
    columns,
    fetchData: endpointFetcher("/api/entries"),
    meta: tableMeta,
  });

  const filterConfigs: DataTableFilterConfig[] = useMemo(
    () => [
      {
        key: "center_id",
        title: "Center",
        options: centerOptions,
        categoryIcon: Building02Icon,
        variant: "stone",
      },
    ],
    [centerOptions],
  );

  return (
    <div className="flex flex-1 flex-col gap-2 min-w-0 min-h-0 h-full overflow-hidden p-1">
      {/* Primary Toolbar */}
      <DataTableToolbar
        instance={dataTable}
        searchPlaceholder="Search entries by vehicle no. or idempotency key..."
        filterConfigs={filterConfigs}
      />

      {/* Table Content Surface */}
      <DataTableContent
        table={dataTable.table}
        loading={dataTable.loading}
        error={dataTable.error}
        onRetry={dataTable.refresh}
      />

      {/* Responsive Pagination Bar */}
      <DataTablePagination table={dataTable.table} loading={dataTable.loading} />

      {/* Entry Photos Dialog */}
      <PhotosDialog
        open={photosDialogState.open}
        onOpenChange={(open) => setPhotosDialogState((prev) => ({ ...prev, open }))}
        weighmentId={photosDialogState.weighmentId}
        vehicleNumber={photosDialogState.vehicleNumber}
        inCenter={photosDialogState.inCenter}
        outCenter={photosDialogState.outCenter}
        images={photosDialogState.images}
      />
    </div>
  );
}
