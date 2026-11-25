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
import { Building02Icon, UserIcon } from "@hugeicons/core-free-icons";
import { appIcons } from "@/lib/icons";
import { PhotosDialog, type PhotoItem } from "@/components/photos-dialog";
import { useWeighmentPdfDownload } from "@/hooks/use-weighment-pdf-download";
import type { Center } from "@/app/centers/types";
import type { User } from "@/app/users/types";
import type { EntityMode } from "@/stores/use-mode-store";
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
  const [centerOptions, setCenterOptions] = useState<FacetedFilterOption[]>([
    { label: "All Centers", value: "all", icon: appIcons.centers },
  ]);
  const [creatorOptions, setCreatorOptions] = useState<FacetedFilterOption[]>([
    { label: "All Creators", value: "all", icon: appIcons.users },
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

  useEffect(() => {
    if (mode !== "manual") return;
    async function loadCreators() {
      try {
        const res = await axios.get<{ data: User[] }>("/api/users?all=true&sort=name.asc");
        const users = res.data.data ?? [];
        setCreatorOptions([
          { label: "All Creators", value: "all", icon: appIcons.users },
          ...users.map((u) => ({
            idPrefix: `#${u.id}`,
            label: u.name,
            value: String(u.id),
          })),
        ]);
      } catch {
        // Non-fatal if creators fail to load
      }
    }
    loadCreators();
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
