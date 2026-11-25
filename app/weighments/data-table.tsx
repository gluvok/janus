"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  DataTableContent,
  DataTablePagination,
  DataTableToolbar,
  DataTableErrorState,
  useDataTable,
  type FacetedFilterOption,
  type DataTableFilterConfig,
} from "@/components/data-table";
import {
  ArrowDownRight01Icon,
  ArrowUpRight01Icon,
  Building02Icon,
  Building03Icon,
  CircleMinusIcon,
  Layers01Icon,
  UserArrowLeftRightIcon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import { getErrorMessage } from "@/lib/utils";
import { appIcons } from "@/lib/icons";
import { useDataTableStore } from "@/stores/use-data-table-store";
import type { EntityMode } from "@/stores/use-mode-store";
import { PhotosDialog, type PhotoItem } from "@/components/photos-dialog";
import { useWeighmentPdfDownload } from "@/hooks/use-weighment-pdf-download";
import { getWeighmentColumns, type WeighmentsTableMeta } from "./columns";
import type { Weighment } from "./types";
import {
  fetchFilterOptions,
  formatCenterOptions,
  formatUserOptions,
  validateAndSanitizeFilters,
  buildWeighmentsQueryParams,
} from "./table-helpers";

const WEIGHMENT_TYPE_OPTIONS: FacetedFilterOption[] = [
  { label: "All types", value: "all", icon: Layers01Icon },
  { label: "In", value: "in", icon: ArrowDownRight01Icon },
  { label: "Out", value: "out", icon: ArrowUpRight01Icon },
  { label: "Void", value: "void", icon: CircleMinusIcon },
];

interface PhotosDialogState {
  open: boolean;
  weighmentId: number;
  vehicleNumber: string;
  inCenter: { id: number; name: string };
  outCenter: { id: number; name: string } | null;
  images: PhotoItem[];
}

export interface WeighmentsDataTableProps {
  mode: EntityMode;
}

export function WeighmentsDataTable({ mode }: WeighmentsDataTableProps) {
  const tableId = mode === "automatic" ? "automatic_weighments" : "manual_weighments";
  const endpoint = `/api/weighments/${mode}`;

  const [inCenterOptions, setInCenterOptions] = useState<FacetedFilterOption[]>([
    { label: "All In Centers", value: "all", icon: Building02Icon },
  ]);
  const [outCenterOptions, setOutCenterOptions] = useState<FacetedFilterOption[]>([
    { label: "All Out Centers", value: "all", icon: Building03Icon },
  ]);
  const [inCreatorOptions, setInCreatorOptions] = useState<FacetedFilterOption[]>([
    { label: "All In Creators", value: "all", icon: appIcons.users },
  ]);
  const [outCreatorOptions, setOutCreatorOptions] = useState<FacetedFilterOption[]>([
    { label: "All Out Creators", value: "all", icon: appIcons.users },
  ]);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<
    { data: Weighment[]; totalCount: number } | undefined
  >();

  const activeLoadIdRef = useRef<number>(0);
  const [photosDialogState, setPhotosDialogState] = useState<PhotosDialogState>({
    open: false,
    weighmentId: 0,
    vehicleNumber: "",
    inCenter: { id: 0, name: "" },
    outCenter: null,
    images: [],
  });

  const { downloadReceipt, downloadingId } = useWeighmentPdfDownload();

  const fetchWeighments = useCallback(
    async (queryParams: Record<string, unknown>) => {
      const res = await axios.get<{ data: Weighment[]; totalCount: number }>(endpoint, {
        params: queryParams,
      });
      return res.data;
    },
    [endpoint],
  );

  const loadInitialData = useCallback(async () => {
    const currentLoadId = ++activeLoadIdRef.current;
    setIsInitialLoading(true);
    setInitialError(null);
    try {
      const tableState = useDataTableStore.getState().getTableState(tableId);
      const initialQueryParams = buildWeighmentsQueryParams(
        tableState,
        tableState.pagination.pageIndex + 1,
        tableState.filters,
      );

      const [optionsResult, weighmentsResult] = await Promise.all([
        fetchFilterOptions(mode),
        axios.get<{ data: Weighment[]; totalCount: number }>(endpoint, {
          params: initialQueryParams,
        }),
      ]);

      if (currentLoadId !== activeLoadIdRef.current) return;

      const { centers, users } = optionsResult;
      const { sanitizedFilters, needsFallback } = validateAndSanitizeFilters(
        tableState.filters,
        centers,
        users,
        mode,
        (key, value) => useDataTableStore.getState().setTableFilter(tableId, key, value),
      );

      let finalWeighments = weighmentsResult.data;
      if (needsFallback) {
        const sanitizedQueryParams = buildWeighmentsQueryParams(tableState, 1, sanitizedFilters);
        const refetchRes = await axios.get<{ data: Weighment[]; totalCount: number }>(endpoint, {
          params: sanitizedQueryParams,
        });
        if (currentLoadId !== activeLoadIdRef.current) return;
        finalWeighments = refetchRes.data;
      }

      setInCenterOptions(formatCenterOptions(centers, "In Centers"));
      setOutCenterOptions(formatCenterOptions(centers, "Out Centers"));
      if (mode === "manual") {
        setInCreatorOptions(formatUserOptions(users, "In Creators"));
        setOutCreatorOptions(formatUserOptions(users, "Out Creators"));
      }
      setInitialData(finalWeighments);
      setIsInitialLoading(false);
    } catch (err) {
      if (currentLoadId === activeLoadIdRef.current) {
        setInitialError(getErrorMessage(err, `Failed to load ${mode} weighments.`));
        setIsInitialLoading(false);
      }
    }
  }, [endpoint, mode, tableId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const tableMeta: WeighmentsTableMeta = useMemo(
    () => ({
      onViewPhotos: (payload) => setPhotosDialogState({ open: true, ...payload }),
      onDownloadPdf: (w) => downloadReceipt(w, mode),
      downloadingId,
    }),
    [downloadReceipt, downloadingId, mode],
  );

  const columns = useMemo(() => getWeighmentColumns(mode), [mode]);

  const dataTable = useDataTable<Weighment>({
    tableId,
    columns,
    fetchData: fetchWeighments,
    meta: tableMeta,
    enabled: !isInitialLoading && !!initialData,
    initialData,
  });

  const filterConfigs = useMemo<DataTableFilterConfig[]>(() => {
    const configs: DataTableFilterConfig[] = [
      {
        key: "type",
        title: "Type",
        options: WEIGHMENT_TYPE_OPTIONS,
        variant: "orange",
        categoryIcon: Layers01Icon,
      },
      {
        key: "in_center_id",
        title: "In Center",
        options: inCenterOptions,
        variant: "stone",
        categoryIcon: Building02Icon,
      },
      {
        key: "out_center_id",
        title: "Out Center",
        options: outCenterOptions,
        variant: "stone",
        categoryIcon: Building03Icon,
      },
    ];

    if (mode === "manual") {
      configs.push(
        {
          key: "in_creator_id",
          title: "In Creator",
          options: inCreatorOptions,
          variant: "stone",
          categoryIcon: UserCheck01Icon,
        },
        {
          key: "out_creator_id",
          title: "Out Creator",
          options: outCreatorOptions,
          variant: "stone",
          categoryIcon: UserArrowLeftRightIcon,
        },
      );
    }

    return configs;
  }, [inCenterOptions, outCenterOptions, inCreatorOptions, outCreatorOptions, mode]);

  if (initialError) {
    return (
      <DataTableErrorState
        title={`Failed to load ${mode} weighments`}
        error={initialError}
        onRetry={loadInitialData}
      />
    );
  }

  const effectiveLoading = dataTable.loading || isInitialLoading;
  const searchPlaceholder =
    mode === "automatic" ? "Search automatic weighments..." : "Search manual weighments...";

  return (
    <div className="flex flex-1 flex-col gap-2 min-w-0 min-h-0 h-full overflow-hidden p-1">
      <DataTableToolbar
        instance={dataTable}
        searchPlaceholder={searchPlaceholder}
        loading={effectiveLoading}
        filterConfigs={filterConfigs}
      />

      <DataTableContent
        table={dataTable.table}
        loading={effectiveLoading}
        error={dataTable.error}
        onRetry={dataTable.refresh}
      />

      <DataTablePagination table={dataTable.table} loading={effectiveLoading} />

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

export function WeighmentsTableContainer({ mode }: WeighmentsDataTableProps) {
  return <WeighmentsDataTable key={mode} mode={mode} />;
}
