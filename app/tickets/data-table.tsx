"use client";

import { useMemo, useState, useCallback } from "react";
import {
  DataTableContent,
  DataTableHydrationCard,
  DataTablePagination,
  DataTableToolbar,
  type DataTableFilterConfig,
  useDataTable,
} from "@/components/data-table";
import {
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  SecurityCheckIcon,
} from "@hugeicons/core-free-icons";
import { columns, type TicketsTableMeta } from "./columns";
import { TicketEditDialog } from "./edit-dialog";
import { TicketDeleteDialog } from "./delete-dialog";
import { type Ticket } from "./types";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending", icon: Clock01Icon },
  { value: "approved", label: "Approved", icon: CheckmarkCircle02Icon },
  { value: "rejected", label: "Rejected", icon: CancelCircleIcon },
];

export function TicketsDataTable() {
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);
  const [deletingTicket, setDeletingTicket] = useState<Ticket | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);

  const handleEditTicket = useCallback((ticket: Ticket) => {
    setEditingTicket(ticket);
    setEditDialogOpen(true);
  }, []);

  const handleDeleteTicket = useCallback((ticket: Ticket) => {
    setDeletingTicket(ticket);
    setDeleteDialogOpen(true);
  }, []);

  const tableMeta = useMemo<TicketsTableMeta>(
    () => ({
      onEditTicket: handleEditTicket,
      onDeleteTicket: handleDeleteTicket,
    }),
    [handleEditTicket, handleDeleteTicket],
  );

  const {
    table,
    loading,
    error,
    hasHydrated,
    search,
    setSearch,
    dateRange,
    setDateRange,
    sorting,
    setSorting,
    removeSort,
    setPagination,
    hasActiveSorts,
    hasActiveFilters,
    resetAllCriteria,
    resetAllFilters,
    resetSorting,
    setFilter,
    refresh,
    tableState,
  } = useDataTable<Ticket>({
    tableId: "tickets",
    columns,
    endpoint: "/api/tickets",
    meta: tableMeta,
  });

  const statusFilter = tableState.filters["status"] ?? "all";

  const filterConfigs: DataTableFilterConfig[] = useMemo(
    () => [
      {
        key: "status",
        title: "Status",
        options: STATUS_FILTER_OPTIONS,
        categoryIcon: SecurityCheckIcon,
        variant: "stone",
      },
    ],
    [],
  );

  const handleMutationSuccess = () => {
    refresh();
  };

  if (!hasHydrated) {
    return <DataTableHydrationCard />;
  }

  return (
    <div className="flex flex-1 flex-col gap-2 min-w-0 min-h-0 h-full overflow-hidden p-1">
      {/* Primary Toolbar */}
      <DataTableToolbar
        table={table}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search tickets by concern or reply..."
        onRefresh={refresh}
        loading={loading}
        dateRange={dateRange}
        onDateRangeChange={(range) => {
          setDateRange(range);
          setPagination((prev) => ({ ...prev, pageIndex: 0 }));
        }}
        filterConfigs={filterConfigs}
        filters={{ status: statusFilter }}
        onFilterChange={(key, val) => {
          if (key === "status") {
            setFilter("status", val);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }
        }}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetAllFilters}
        hasActiveSorts={hasActiveSorts}
        sorting={sorting}
        onSortingChange={(updater) => {
          setSorting(updater);
          setPagination((prev) => ({ ...prev, pageIndex: 0 }));
        }}
        onRemoveSort={(columnId) => {
          removeSort(columnId);
          setPagination((prev) => ({ ...prev, pageIndex: 0 }));
        }}
        onResetAll={resetAllCriteria}
        onResetSorts={resetSorting}
      />

      {/* Table Content Surface */}
      <DataTableContent table={table} loading={loading} error={error} />

      {/* Responsive Pagination Bar */}
      <DataTablePagination table={table} />

      {/* Edit Ticket Dialog */}
      <TicketEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        ticket={editingTicket}
        onSuccess={handleMutationSuccess}
      />

      {/* Delete Ticket Confirmation Dialog */}
      <TicketDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        ticket={deletingTicket}
        onSuccess={handleMutationSuccess}
      />
    </div>
  );
}
