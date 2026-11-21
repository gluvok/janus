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
  Clock01Icon,
  Layers01Icon,
} from "@hugeicons/core-free-icons";
import { getErrorMessage } from "@/lib/utils";
import { useDataTableStore } from "@/stores/use-data-table-store";
import { DEFAULT_TABLE_ITEM_STATE } from "@/lib/table-strategy";
import { PhotosDialog, type PhotoItem } from "@/components/photos-dialog";
import { useAutomaticWeighmentPdfDownload } from "@/hooks/use-automatic-weighment-pdf-download";
import { useManualWeighmentPdfDownload } from "@/hooks/use-manual-weighment-pdf-download";
import { getWeighmentColumns, type WeighmentsTableMeta, type AnyWeighment } from "./columns";
import type { AutomaticWeighment, ManualWeighment, WeighmentMode } from "./types";
import {
  fetchFilterOptions,
  formatCenterOptions,
  validateAndSanitizeFilters,
  buildWeighmentsQueryParams,
} from "./table-helpers";

const AUTOMATIC_TYPE_OPTIONS: FacetedFilterOption[] = [
  { label: "All types", value: "all", icon: Layers01Icon },
  { label: "Pending", value: "pending", icon: Clock01Icon },
  { label: "In", value: "in", icon: ArrowDownRight01Icon },
  { label: "Out", value: "out", icon: ArrowUpRight01Icon },
  { label: "Unassigned", value: "unassigned", icon: CircleMinusIcon },
];

const MANUAL_TYPE_OPTIONS: FacetedFilterOption[] = [
  { label: "All types", value: "all", icon: Layers01Icon },
  { label: "In", value: "in", icon: ArrowDownRight01Icon },
  { label: "Out", value: "out", icon: ArrowUpRight01Icon },
  { label: "Unassigned", value: "unassigned", icon: CircleMinusIcon },
];

const WEIGHMENT_CONFIG = {
  automatic: {
    endpoint: "/api/weighments/automatic",
    typeOptions: AUTOMATIC_TYPE_OPTIONS,
  },
  manual: {
    endpoint: "/api/weighments/manual",
    typeOptions: MANUAL_TYPE_OPTIONS,
  },
} as const;

export function WeighmentsDataTable() {
  const currentTableState =
    useDataTableStore((state) => state.tables["weighments"]) ?? DEFAULT_TABLE_ITEM_STATE;
  const mode = (currentTableState.mode ?? "automatic") as WeighmentMode;
  const config = WEIGHMENT_CONFIG[mode];

  const [inCenterOptions, setInCenterOptions] = useState<FacetedFilterOption[]>([
    { label: "All In Centers", value: "all", icon: Building02Icon },
  ]);
  const [outCenterOptions, setOutCenterOptions] = useState<FacetedFilterOption[]>([
    { label: "All Out Centers", value: "all", icon: Building03Icon },
  ]);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<
    { data: AnyWeighment[]; totalCount: number } | undefined
  >();

  const activeLoadIdRef = useRef<number>(0);
  const [photosDialogState, setPhotosDialogState] = useState<{
    open: boolean;
    weighmentId: number;
    vehicleNumber: string;
    inCenter: { id: number; name: string };
    outCenter: { id: number; name: string } | null;
    images: PhotoItem[];
  }>({
    open: false,
    weighmentId: 0,
    vehicleNumber: "",
    inCenter: { id: 0, name: "" },
    outCenter: null,
    images: [],
  });

  const { downloadAutomaticPdf, downloadingId: autoDownloadingId } =
    useAutomaticWeighmentPdfDownload();
  const { downloadManualPdf, downloadingId: manualDownloadingId } = useManualWeighmentPdfDownload();

  const handleDownloadPdf = useCallback(
    (weighment: AnyWeighment) => {
      if (mode === "manual") {
        downloadManualPdf(weighment as ManualWeighment);
      } else {
        downloadAutomaticPdf(weighment as AutomaticWeighment);
      }
    },
    [mode, downloadManualPdf, downloadAutomaticPdf],
  );

  const fetchWeighments = useCallback(
    async (queryParams: Record<string, unknown>) => {
      const res = await axios.get<{ data: AnyWeighment[]; totalCount: number }>(config.endpoint, {
        params: queryParams,
      });
      return res.data;
    },
    [config.endpoint],
  );

  const loadInitialData = useCallback(async () => {
    const currentLoadId = ++activeLoadIdRef.current;
    setIsInitialLoading(true);
    setInitialError(null);
    try {
      const tableState = useDataTableStore.getState().getTableState("weighments");
      const currentMode = (tableState.mode ?? "automatic") as WeighmentMode;
      const endpoint = WEIGHMENT_CONFIG[currentMode].endpoint;

      const initialQueryParams = buildWeighmentsQueryParams(
        tableState,
        currentMode,
        tableState.pagination.pageIndex + 1,
        tableState.filters,
      );

      const [optionsResult, weighmentsResult] = await Promise.all([
        fetchFilterOptions(),
        axios.get<{ data: AnyWeighment[]; totalCount: number }>(endpoint, {
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
          currentMode,
          1,
          sanitizedFilters,
        );
        const refetchRes = await axios.get<{ data: AnyWeighment[]; totalCount: number }>(endpoint, {
          params: sanitizedQueryParams,
        });
        if (currentLoadId !== activeLoadIdRef.current) return;
        finalWeighments = refetchRes.data;
      }

      setInCenterOptions(formatCenterOptions(centers, "In Centers"));
      setOutCenterOptions(formatCenterOptions(centers, "Out Centers"));
      setInitialData(finalWeighments);
      setIsInitialLoading(false);
    } catch (err) {
      if (currentLoadId === activeLoadIdRef.current) {
        setInitialError(getErrorMessage(err, "Failed to load weighments."));
        setIsInitialLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const tableMeta: WeighmentsTableMeta = useMemo(
    () => ({
      onViewPhotos: (payload) => setPhotosDialogState({ open: true, ...payload }),
      onDownloadPdf: handleDownloadPdf,
      downloadingId: autoDownloadingId ?? manualDownloadingId,
    }),
    [handleDownloadPdf, autoDownloadingId, manualDownloadingId],
  );

  const columns = useMemo(() => getWeighmentColumns(mode), [mode]);
  const extraParams = useMemo(() => ({ mode }), [mode]);

  const dataTable = useDataTable<AnyWeighment>({
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
        options: config.typeOptions,
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
  }, [config.typeOptions, inCenterOptions, outCenterOptions]);

  if (initialError) {
    return (
      <DataTableErrorState
        title="Failed to load weighments"
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
