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
  Loading03Icon,
  PrinterIcon,
  UserArrowLeftRightIcon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/utils";
import { appIcons } from "@/lib/icons";
import { useDataTableStore } from "@/stores/use-data-table-store";
import type { EntityMode } from "@/stores/use-mode-store";
import { useUserStore } from "@/stores/use-user-store";
import { PhotosDialog, type PhotoItem } from "@/components/photos-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { toast } from "@/components/ui/toast";
import { useWeighmentPdfDownload } from "@/hooks/use-weighment-pdf-download";
import type { UserRole } from "@/app/users/types";
import { getWeighmentColumns, type WeighmentsTableMeta } from "./columns";
import type { Weighment } from "./types";
import { CorrectPlateDialog } from "./weighment-action-dialogs";
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

type WeighmentPermissions = {
  correctPlate: boolean;
  deleteWeighment: boolean;
};

const NO_WEIGHMENT_PERMISSIONS: WeighmentPermissions = {
  correctPlate: false,
  deleteWeighment: false,
};

const WEIGHMENT_ACTION_MATRIX: Record<EntityMode, Record<UserRole, WeighmentPermissions>> = {
  automatic: {
    admin: { correctPlate: true, deleteWeighment: true },
    manager: NO_WEIGHMENT_PERMISSIONS,
    operator: NO_WEIGHMENT_PERMISSIONS,
    base: NO_WEIGHMENT_PERMISSIONS,
  },
  manual: {
    admin: NO_WEIGHMENT_PERMISSIONS,
    manager: NO_WEIGHMENT_PERMISSIONS,
    operator: NO_WEIGHMENT_PERMISSIONS,
    base: NO_WEIGHMENT_PERMISSIONS,
  },
};

function getWeighmentPermissions(
  mode: EntityMode,
  role: UserRole | null | undefined,
): WeighmentPermissions {
  if (!role) return NO_WEIGHMENT_PERMISSIONS;
  return WEIGHMENT_ACTION_MATRIX[mode][role] ?? NO_WEIGHMENT_PERMISSIONS;
}

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

  const { downloadReceipt, downloadingId, downloadBatchReceipts, isBatchPrinting } =
    useWeighmentPdfDownload();
  const currentUser = useUserStore((s) => s.user);
  const permissions = getWeighmentPermissions(mode, currentUser?.role);

  const [correctPlateWeighment, setCorrectPlateWeighment] = useState<Weighment | null>(null);
  const [deleteWeighment, setDeleteWeighment] = useState<Weighment | null>(null);

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
      onCorrectPlate: permissions.correctPlate ? setCorrectPlateWeighment : undefined,
      onDelete: permissions.deleteWeighment ? setDeleteWeighment : undefined,
    }),
    [downloadReceipt, downloadingId, mode, permissions.correctPlate, permissions.deleteWeighment],
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

      {dataTable.selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-md border border-border/80 bg-muted/40 px-3 py-1.5 text-xs">
          <span className="font-medium text-muted-foreground">
            {dataTable.selectedCount} weighment{dataTable.selectedCount > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => dataTable.setRowSelection({})}
              className="h-6 px-2 text-2xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="xs"
              disabled={isBatchPrinting}
              onClick={() => downloadBatchReceipts(dataTable.selectedRows, mode)}
              className="h-6 gap-1.5 text-2xs"
            >
              <HugeiconsIcon
                icon={isBatchPrinting ? Loading03Icon : PrinterIcon}
                className={isBatchPrinting ? "size-3.5 animate-spin" : "size-3.5"}
              />
              <span>Print PDF</span>
            </Button>
          </div>
        </div>
      )}

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

      {permissions.correctPlate && (
        <CorrectPlateDialog
          open={!!correctPlateWeighment}
          onOpenChange={(open) => {
            if (!open) setCorrectPlateWeighment(null);
          }}
          weighment={correctPlateWeighment}
          onSuccess={dataTable.refresh}
        />
      )}

      {permissions.deleteWeighment && (
        <ConfirmDeleteDialog
          open={!!deleteWeighment}
          onOpenChange={(open) => {
            if (!open) setDeleteWeighment(null);
          }}
          title={`Delete Weighment #${deleteWeighment?.id ?? ""}`}
          description={`This will delete weighment #${deleteWeighment?.id ?? ""} (${deleteWeighment?.vehicle_number ?? ""}) and both linked entries (#${deleteWeighment?.in_entry_id ?? ""} and #${deleteWeighment?.out_entry_id ?? ""}).`}
          deleteLabel="Delete Weighment"
          onConfirm={async () => {
            if (!deleteWeighment) return;
            await axios.delete(`/api/weighments/automatic/${deleteWeighment.id}`);
            toast.add({
              type: "success",
              title: "Weighment deleted",
              description: `Weighment #${deleteWeighment.id} and its linked entries were deleted.`,
            });
            dataTable.refresh();
          }}
        />
      )}
    </div>
  );
}

export function WeighmentsTableContainer({ mode }: WeighmentsDataTableProps) {
  return <WeighmentsDataTable key={mode} mode={mode} />;
}
