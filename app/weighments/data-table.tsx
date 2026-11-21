"use client";

import { z } from "zod";
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
import { appIcons } from "@/lib/icons";
import { getErrorMessage } from "@/lib/utils";
import { useDataTableStore } from "@/stores/use-data-table-store";
import { type TableItemState, DEFAULT_TABLE_ITEM_STATE } from "@/lib/table-strategy";
import { PhotosDialog, type PhotoItem } from "@/components/photos-dialog";
import { useAutomaticWeighmentPdfDownload } from "@/components/weighment-receipt/use-automatic-weighment-pdf-download";
import { useManualWeighmentPdfDownload } from "@/components/weighment-receipt/use-manual-weighment-pdf-download";
import { WEIGHMENT_COLUMNS, type WeighmentsTableMeta } from "./columns";
import type { Weighment, WeighmentMode, AutomaticWeighment, ManualWeighment } from "./types";
import type { Center } from "@/app/centers/types";

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

const WEIGHMENT_ENDPOINTS: Record<WeighmentMode, string> = {
  automatic: "/api/weighments/automatic",
  manual: "/api/weighments/manual",
};

function formatCenterOptions(centers: Center[], title: string): FacetedFilterOption[] {
  return [
    { label: `All ${title}`, value: "all", icon: appIcons.centers },
    ...centers.map((c) => ({
      idPrefix: `#${c.id}`,
      label: c.name,
      value: String(c.id),
    })),
  ];
}

async function fetchFilterOptions() {
  const centersRes = await axios.get<{ data: Center[] }>("/api/centers?all=true&sort=name.asc");
  return {
    centers: centersRes.data.data ?? [],
  };
}

function createFilterSanitizerSchema(validIds: Set<string>) {
  return z.string().transform((val) => {
    if (!val || val === "all") return "all";
    const ids = val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const valid = ids.filter((id) => validIds.has(id));
    return valid.length === 0 ? "all" : valid.join(",");
  });
}

function validateAndSanitizeFilters(
  currentFilters: Record<string, string>,
  centers: Center[],
  onReset: (key: string) => void,
): { sanitizedFilters: Record<string, string>; needsFallback: boolean } {
  let needsFallback = false;
  const sanitizedFilters = { ...currentFilters };
  const dynamicEntityChecks: Array<{ key: string; validIds: Set<string> }> = [
    { key: "in_center_id", validIds: new Set(centers.map((c) => String(c.id))) },
    { key: "out_center_id", validIds: new Set(centers.map((c) => String(c.id))) },
  ];

  for (const { key, validIds } of dynamicEntityChecks) {
    const filterVal = sanitizedFilters[key];
    if (filterVal && filterVal !== "all") {
      const schema = createFilterSanitizerSchema(validIds);
      const parsed = schema.safeParse(filterVal);
      if (parsed.success) {
        if (parsed.data !== filterVal) {
          sanitizedFilters[key] = parsed.data;
          needsFallback = true;
          if (parsed.data === "all") {
            onReset(key);
          }
        }
      } else {
        sanitizedFilters[key] = "all";
        onReset(key);
        needsFallback = true;
      }
    }
  }

  return { sanitizedFilters, needsFallback };
}

function buildWeighmentsQueryParams(
  tableState: TableItemState,
  mode: WeighmentMode,
  page: number,
  filters: Record<string, string>,
): Record<string, unknown> {
  const pagination = tableState.pagination;
  const sorting = tableState.sorting;
  const search = tableState.search;
  const fromIso = tableState.dateRange?.from;
  const toIso = tableState.dateRange?.to;

  return {
    mode,
    page,
    pageSize: pagination.pageSize,
    ...(sorting.length > 0 && {
      sort: sorting.map((s) => `${s.id}.${s.desc ? "desc" : "asc"}`).join(","),
    }),
    ...(search && { search }),
    ...(fromIso && { from: fromIso }),
    ...(toIso && { to: toIso }),
    ...filters,
  };
}

export function WeighmentsDataTable() {
  const [inCenterOptions, setInCenterOptions] = useState<FacetedFilterOption[]>([
    { label: "All In Centers", value: "all", icon: Building02Icon },
  ]);
  const [outCenterOptions, setOutCenterOptions] = useState<FacetedFilterOption[]>([
    { label: "All Out Centers", value: "all", icon: Building03Icon },
  ]);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<
    { data: Weighment[]; totalCount: number } | undefined
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

  const { downloadAutomaticPdf, downloadingId: downloadingAutoId } =
    useAutomaticWeighmentPdfDownload();
  const { downloadManualPdf, downloadingId: downloadingManualId } = useManualWeighmentPdfDownload();

  const handleViewPhotos = useCallback(
    (payload: {
      weighmentId: number;
      vehicleNumber: string;
      inCenter: { id: number; name: string };
      outCenter: { id: number; name: string } | null;
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
    const mode = (queryParams.mode as WeighmentMode) ?? "automatic";
    const endpoint = WEIGHMENT_ENDPOINTS[mode];
    const res = await axios.get<{ data: Weighment[]; totalCount: number }>(endpoint, {
      params: queryParams,
    });
    return res.data;
  }, []);

  const loadInitialData = useCallback(async () => {
    const currentLoadId = ++activeLoadIdRef.current;
    setIsInitialLoading(true);
    setInitialError(null);
    try {
      const tableState = useDataTableStore.getState().getTableState("weighments");
      const mode = (tableState.mode ?? "automatic") as WeighmentMode;
      const initialQueryParams = buildWeighmentsQueryParams(
        tableState,
        mode,
        tableState.pagination.pageIndex + 1,
        tableState.filters,
      );
      const initialEndpoint = WEIGHMENT_ENDPOINTS[mode];

      const [optionsResult, weighmentsResult] = await Promise.all([
        fetchFilterOptions(),
        axios.get<{ data: Weighment[]; totalCount: number }>(initialEndpoint, {
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
          mode,
          1,
          sanitizedFilters,
        );
        const refetchRes = await axios.get<{ data: Weighment[]; totalCount: number }>(
          initialEndpoint,
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
        setInitialError(getErrorMessage(err, "Failed to load weighments."));
        setIsInitialLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const currentTableState =
    useDataTableStore((state) => state.tables["weighments"]) ?? DEFAULT_TABLE_ITEM_STATE;
  const mode = (currentTableState.mode ?? "automatic") as WeighmentMode;

  const tableMeta: WeighmentsTableMeta = useMemo(
    () => ({
      onViewPhotos: handleViewPhotos,
      onDownloadPdf: (weighment: Weighment) => {
        if (mode === "manual") {
          downloadManualPdf(weighment as ManualWeighment);
        } else {
          downloadAutomaticPdf(weighment as AutomaticWeighment);
        }
      },
      downloadingId: downloadingManualId ?? downloadingAutoId,
    }),
    [
      handleViewPhotos,
      downloadManualPdf,
      downloadAutomaticPdf,
      mode,
      downloadingManualId,
      downloadingAutoId,
    ],
  );

  const columns = useMemo(() => WEIGHMENT_COLUMNS[mode](), [mode]);
  const extraParams = useMemo(() => ({ mode }), [mode]);

  const dataTable = useDataTable<Weighment>({
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
        options: mode === "manual" ? MANUAL_TYPE_OPTIONS : AUTOMATIC_TYPE_OPTIONS,
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
  }, [mode, inCenterOptions, outCenterOptions]);

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
      {/* Primary Toolbar - 2-Tier Layout with Integrated Multi-Sort */}
      <DataTableToolbar
        instance={dataTable}
        searchPlaceholder="Search weighments..."
        loading={effectiveLoading}
        filterConfigs={filterConfigs}
      />

      {/* Reusable Data Table Content */}
      <DataTableContent
        table={dataTable.table}
        loading={effectiveLoading}
        error={dataTable.error}
        onRetry={dataTable.refresh}
      />

      {/* Permanently Anchored Bottom Pagination Bar */}
      <DataTablePagination table={dataTable.table} loading={effectiveLoading} />

      {/* Consolidated Photo Carousel Modal */}
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
