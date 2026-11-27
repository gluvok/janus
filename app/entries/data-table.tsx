"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DataTableContent,
  DataTablePagination,
  DataTableToolbar,
  useDataTable,
  endpointFetcher,
  type DataTableFilterConfig,
} from "@/components/data-table";
import { Building02Icon, UserIcon } from "@hugeicons/core-free-icons";
import { PhotosDialog, type PhotoItem } from "@/components/photos-dialog";
import { toast } from "@/components/ui/toast";
import { useWeighmentPdfDownload } from "@/hooks/use-weighment-pdf-download";
import { getErrorMessage } from "@/lib/utils";
import type { EntityMode } from "@/stores/use-mode-store";
import {
  fetchFilterOptions,
  formatCenterOptions,
  formatUserOptions,
} from "@/app/weighments/table-helpers";
import { getEntryColumns, type EntriesTableMeta, type EntryRow } from "./columns";

interface PhotosDialogState {
  open: boolean;
  weighmentId: number;
  vehicleNumber: string;
  inCenter: { id: number; name: string };
  outCenter: { id: number; name: string } | null;
  images: PhotoItem[];
}

export interface EntriesDataTableProps {
  mode: EntityMode;
}

export function EntriesDataTable({ mode }: EntriesDataTableProps) {
  const [centerOptions, setCenterOptions] = useState(() => formatCenterOptions([], "Centers"));
  const [creatorOptions, setCreatorOptions] = useState(() => formatUserOptions([], "Creators"));

  const [photosDialogState, setPhotosDialogState] = useState<PhotosDialogState>({
    open: false,
    weighmentId: 0,
    vehicleNumber: "",
    inCenter: { id: 0, name: "" },
    outCenter: null,
    images: [],
  });

  useEffect(() => {
    let cancelled = false;
    fetchFilterOptions(mode)
      .then(({ centers, users }) => {
        if (cancelled) return;
        setCenterOptions(formatCenterOptions(centers, "Centers"));
        if (mode === "manual") setCreatorOptions(formatUserOptions(users, "Creators"));
      })
      .catch((err) => {
        if (cancelled) return;
        toast.add({
          type: "error",
          title: "Failed to load filters",
          description: getErrorMessage(err, "Failed to load filter options."),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const { downloadEntryReceipt, downloadingId } = useWeighmentPdfDownload();

  const tableMeta: EntriesTableMeta = useMemo(
    () => ({
      onViewPhotos: (payload) => setPhotosDialogState({ open: true, ...payload }),
      onDownloadPdf: (entry) => downloadEntryReceipt(entry, mode),
      isDownloadingPdf: (id) => downloadingId === id,
    }),
    [downloadEntryReceipt, downloadingId, mode],
  );

  const columns = useMemo(() => getEntryColumns(mode), [mode]);
  const fetchData = useMemo(() => endpointFetcher<EntryRow>(`/api/entries/${mode}`), [mode]);
  const tableId = mode === "automatic" ? "automatic_entries" : "manual_entries";

  const dataTable = useDataTable<EntryRow>({
    tableId,
    columns,
    fetchData,
    meta: tableMeta,
  });

  const filterConfigs: DataTableFilterConfig[] = useMemo(() => {
    const configs: DataTableFilterConfig[] = [
      {
        key: "center_id",
        title: "Center",
        options: centerOptions,
        categoryIcon: Building02Icon,
        variant: "stone",
      },
    ];
    if (mode === "manual") {
      configs.push({
        key: "creator_id",
        title: "Creator",
        options: creatorOptions,
        categoryIcon: UserIcon,
        variant: "stone",
      });
    }
    return configs;
  }, [centerOptions, creatorOptions, mode]);

  const searchPlaceholder =
    mode === "automatic" ? "Search automatic entries..." : "Search manual entries...";

  return (
    <div className="flex flex-1 flex-col gap-2 min-w-0 min-h-0 h-full overflow-hidden p-1">
      {/* Primary Toolbar */}
      <DataTableToolbar
        instance={dataTable}
        searchPlaceholder={searchPlaceholder}
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
        entityLabel="Entry"
      />
    </div>
  );
}
