"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RowData } from "@tanstack/react-table";
import axios from "axios";
import {
  DataTableContent,
  DataTablePagination,
  DataTableToolbar,
  DataTableErrorState,
  useDataTable,
  type UseDataTableReturn,
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
import {
  getAutomaticWeighmentColumns,
  getManualWeighmentColumns,
  type AutomaticWeighmentsTableMeta,
  type ManualWeighmentsTableMeta,
} from "./columns";
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

interface PhotosDialogState {
  open: boolean;
  weighmentId: number;
  vehicleNumber: string;
  inCenter: { id: number; name: string };
  outCenter: { id: number; name: string } | null;
  images: PhotoItem[];
}

interface WeighmentsTableShellProps<TData extends RowData> {
  dataTable: UseDataTableReturn<TData>;
  filterConfigs: DataTableFilterConfig[];
  effectiveLoading: boolean;
  photosDialogState: PhotosDialogState;
  onPhotosDialogChange: (open: boolean) => void;
}

export function WeighmentsTableShell<TData extends RowData>({
  dataTable,
  filterConfigs,
  effectiveLoading,
  photosDialogState,
  onPhotosDialogChange,
}: WeighmentsTableShellProps<TData>) {
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
        onOpenChange={onPhotosDialogChange}
        weighmentId={photosDialogState.weighmentId}
        vehicleNumber={photosDialogState.vehicleNumber}
        inCenter={photosDialogState.inCenter}
        outCenter={photosDialogState.outCenter}
        images={photosDialogState.images}
      />
    </div>
  );
}

export function AutomaticWeighmentsDataTable() {
  const [inCenterOptions, setInCenterOptions] = useState<FacetedFilterOption[]>([
    { label: "All In Centers", value: "all", icon: Building02Icon },
  ]);
  const [outCenterOptions, setOutCenterOptions] = useState<FacetedFilterOption[]>([
    { label: "All Out Centers", value: "all", icon: Building03Icon },
  ]);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<
    { data: AutomaticWeighment[]; totalCount: number } | undefined
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

  const { downloadAutomaticPdf, downloadingId: autoDownloadingId } =
    useAutomaticWeighmentPdfDownload();

  const fetchWeighments = useCallback(async (queryParams: Record<string, unknown>) => {
    const res = await axios.get<{ data: AutomaticWeighment[]; totalCount: number }>(
      "/api/weighments/automatic",
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
        "automatic",
        tableState.pagination.pageIndex + 1,
        tableState.filters,
      );

      const [optionsResult, weighmentsResult] = await Promise.all([
        fetchFilterOptions(),
        axios.get<{ data: AutomaticWeighment[]; totalCount: number }>("/api/weighments/automatic", {
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
          "automatic",
          1,
          sanitizedFilters,
        );
        const refetchRes = await axios.get<{ data: AutomaticWeighment[]; totalCount: number }>(
          "/api/weighments/automatic",
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
        setInitialError(getErrorMessage(err, "Failed to load automatic weighments."));
        setIsInitialLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const tableMeta: AutomaticWeighmentsTableMeta = useMemo(
    () => ({
      onViewPhotos: (payload) => setPhotosDialogState({ open: true, ...payload }),
      onDownloadPdf: (w) => downloadAutomaticPdf(w),
      downloadingId: autoDownloadingId,
    }),
    [downloadAutomaticPdf, autoDownloadingId],
  );

  const columns = useMemo(() => getAutomaticWeighmentColumns(), []);

  const dataTable = useDataTable<AutomaticWeighment>({
    tableId: "weighments",
    columns,
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
        options: AUTOMATIC_TYPE_OPTIONS,
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
        title="Failed to load weighments"
        error={initialError}
        onRetry={loadInitialData}
      />
    );
  }

  const effectiveLoading = dataTable.loading || isInitialLoading;

  return (
    <WeighmentsTableShell
      dataTable={dataTable}
      filterConfigs={filterConfigs}
      effectiveLoading={effectiveLoading}
      photosDialogState={photosDialogState}
      onPhotosDialogChange={(open) => setPhotosDialogState((prev) => ({ ...prev, open }))}
    />
  );
}

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
  const [photosDialogState, setPhotosDialogState] = useState<PhotosDialogState>({
    open: false,
    weighmentId: 0,
    vehicleNumber: "",
    inCenter: { id: 0, name: "" },
    outCenter: null,
    images: [],
  });

  const { downloadManualPdf, downloadingId: manualDownloadingId } = useManualWeighmentPdfDownload();

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

      // Check if 'pending' type filter exists and sanitize it for manual mode
      if (sanitizedFilters.type === "pending") {
        useDataTableStore.getState().setTableFilter("weighments", "type", "all");
        delete sanitizedFilters.type;
      }

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
      onViewPhotos: (payload) => setPhotosDialogState({ open: true, ...payload }),
      onDownloadPdf: (w) => downloadManualPdf(w),
      downloadingId: manualDownloadingId,
    }),
    [downloadManualPdf, manualDownloadingId],
  );

  const columns = useMemo(() => getManualWeighmentColumns(), []);

  const dataTable = useDataTable<ManualWeighment>({
    tableId: "weighments",
    columns,
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
        title="Failed to load weighments"
        error={initialError}
        onRetry={loadInitialData}
      />
    );
  }

  const effectiveLoading = dataTable.loading || isInitialLoading;

  return (
    <WeighmentsTableShell
      dataTable={dataTable}
      filterConfigs={filterConfigs}
      effectiveLoading={effectiveLoading}
      photosDialogState={photosDialogState}
      onPhotosDialogChange={(open) => setPhotosDialogState((prev) => ({ ...prev, open }))}
    />
  );
}

export function WeighmentsTableContainer() {
  const currentTableState =
    useDataTableStore((state) => state.tables["weighments"]) ?? DEFAULT_TABLE_ITEM_STATE;
  const mode = (currentTableState.mode ?? "automatic") as WeighmentMode;

  if (mode === "manual") {
    return <ManualWeighmentsDataTable />;
  }

  return <AutomaticWeighmentsDataTable />;
}
