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
} from "@hugeicons/core-free-icons";
import { getErrorMessage } from "@/lib/utils";
import { useDataTableStore } from "@/stores/use-data-table-store";
import { PhotosDialog, type PhotoItem } from "@/components/photos-dialog";
import { useManualWeighmentPdfDownload } from "@/components/weighment-receipt/use-manual-weighment-pdf-download";
import { getManualWeighmentColumns, type ManualWeighmentsTableMeta } from "./manual-columns";
import type { ManualWeighment } from "./types";
import {
  fetchFilterOptions,
  formatCenterOptions,
  validateAndSanitizeFilters,
  buildWeighmentsQueryParams,
} from "./table-helpers";

const MANUAL_TYPE_OPTIONS: FacetedFilterOption[] = [
  { label: "All types", value: "all", icon: Layers01Icon },
  { label: "In", value: "in", icon: ArrowDownRight01Icon },
  { label: "Out", value: "out", icon: ArrowUpRight01Icon },
  { label: "Unassigned", value: "unassigned", icon: CircleMinusIcon },
];

export function ManualWeighmentsDataTable() {
  const [inCenterOptions, setInCenterOptions] = useState<FacetedFilterOption[]>([
    { label: "All In Centers", value: "all", icon: Building02Icon },
  ]);
  const [outCenterOptions, setOutCenterOptions] = useState<FacetedFilterOption[]>([
    { label: "All Out Centers", value: "all", icon: Building03Icon },
  ]);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<
    { data: ManualWeighment[]; totalCount: number } | undefined
  >();

  const activeLoadIdRef = useRef<number>(0);
  const [photosDialogState, setPhotosDialogState] = useState<{
    open: boolean;
    weighmentId: number;
    vehicleNumber: string;
    inCenter: { id: number; name: string };
    outCenter: { id: number; name: string };
    images: PhotoItem[];
  }>({
    open: false,
    weighmentId: 0,
    vehicleNumber: "",
    inCenter: { id: 0, name: "" },
    outCenter: { id: 0, name: "" },
    images: [],
  });

  const { downloadManualPdf, downloadingId } = useManualWeighmentPdfDownload();

  const handleViewPhotos = useCallback(
    (payload: {
      weighmentId: number;
      vehicleNumber: string;
      inCenter: { id: number; name: string };
      outCenter: { id: number; name: string };
      images: PhotoItem[];
    }) => {
      setPhotosDialogState({
        open: true,
        ...payload,
      });
    },
    [],
  );

  const fetchWeighments = useCallback(async (queryParams: Record<string, unknown>) => {
    const res = await axios.get<{ data: ManualWeighment[]; totalCount: number }>(
      "/api/weighments/manual",
      { params: queryParams },
    );
    return res.data;
  }, []);

  const loadInitialData = useCallback(async () => {
    const currentLoadId = ++activeLoadIdRef.current;
    setIsInitialLoading(true);
    setInitialError(null);
    try {
      const tableState = useDataTableStore.getState().getTableState("weighments");
      const initialQueryParams = buildWeighmentsQueryParams(
        tableState,
        "manual",
        tableState.pagination.pageIndex + 1,
        tableState.filters,
      );

      const [optionsResult, weighmentsResult] = await Promise.all([
        fetchFilterOptions(),
        axios.get<{ data: ManualWeighment[]; totalCount: number }>("/api/weighments/manual", {
          params: initialQueryParams,
        }),
      ]);

      if (currentLoadId !== activeLoadIdRef.current) return;

      const { centers } = optionsResult;
      const { sanitizedFilters, needsFallback } = validateAndSanitizeFilters(
        tableState.filters,
        centers,
        (key) => useDataTableStore.getState().setTableFilter("weighments", key, "all"),
      );

      let finalWeighments = weighmentsResult.data;
      if (needsFallback) {
        const sanitizedQueryParams = buildWeighmentsQueryParams(
          tableState,
          "manual",
          1,
          sanitizedFilters,
        );
        const refetchRes = await axios.get<{ data: ManualWeighment[]; totalCount: number }>(
          "/api/weighments/manual",
          { params: sanitizedQueryParams },
        );
        if (currentLoadId !== activeLoadIdRef.current) return;
        finalWeighments = refetchRes.data;
      }

      setInCenterOptions(formatCenterOptions(centers, "In Centers"));
      setOutCenterOptions(formatCenterOptions(centers, "Out Centers"));
      setInitialData(finalWeighments);
      setIsInitialLoading(false);
    } catch (err) {
      if (currentLoadId === activeLoadIdRef.current) {
        setInitialError(getErrorMessage(err, "Failed to load manual weighments."));
        setIsInitialLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const tableMeta: ManualWeighmentsTableMeta = useMemo(
    () => ({
      onViewPhotos: handleViewPhotos,
      onDownloadPdf: downloadManualPdf,
      downloadingId,
    }),
    [handleViewPhotos, downloadManualPdf, downloadingId],
  );

  const columns = useMemo(() => getManualWeighmentColumns(), []);
  const extraParams = useMemo(() => ({ mode: "manual" }), []);

  const dataTable = useDataTable<ManualWeighment>({
    tableId: "weighments",
    columns,
    extraParams,
    fetchData: fetchWeighments,
    meta: tableMeta,
    enabled: !isInitialLoading && !!initialData,
    initialData,
  });

  const filterConfigs = useMemo<DataTableFilterConfig[]>(() => {
    return [
      {
        key: "type",
        title: "Type",
        options: MANUAL_TYPE_OPTIONS,
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
  }, [inCenterOptions, outCenterOptions]);

  if (initialError) {
    return (
      <DataTableErrorState
        title="Failed to load manual weighments"
        error={initialError}
        onRetry={loadInitialData}
      />
    );
  }

  const effectiveLoading = dataTable.loading || isInitialLoading;

  return (
    <div className="flex flex-1 flex-col gap-2 min-w-0 min-h-0 h-full overflow-hidden p-1">
      <DataTableToolbar
        instance={dataTable}
        searchPlaceholder="Search weighments..."
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
