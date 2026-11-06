"use client";

import { useMemo, useState, useCallback } from "react";
import {
  DataTableContent,
  DataTableCriteriaBar,
  DataTableFacetedFilter,
  DataTableHydrationCard,
  DataTablePagination,
  DataTableRefreshButton,
  DataTableSearchInput,
  DataTableViewOptions,
  DatePickerWithRange,
  useDataTable,
} from "@/components/data-table";
import {
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  SecurityCheckIcon,
} from "@hugeicons/core-free-icons";
import { columns, type TicketsTableMeta } from "./columns";
import { TicketEditDialog } from "./ticket-edit-dialog";
import { TicketDeleteDialog } from "./ticket-delete-dialog";
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
    resetAllCriteria,
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

  const handleMutationSuccess = () => {
    refresh();
  };

  if (!hasHydrated) {
    return <DataTableHydrationCard />;
  }

  return (
    <div className="flex flex-1 flex-col gap-2 min-w-0 min-h-0 h-full overflow-hidden p-1">
      {/* Primary Toolbar */}
      <div className="flex flex-col gap-2 shrink-0 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input (Left) */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
          <DataTableSearchInput
            placeholder="Search tickets by concern or reply..."
            value={search}
            onChange={setSearch}
          />
        </div>

        {/* Action Controls Group (Right) */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <DataTableRefreshButton onClick={refresh} loading={loading} />
          <DatePickerWithRange
            date={dateRange}
            onDateChange={(range) => {
              setDateRange(range);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            className="flex-1 sm:flex-initial"
          />

          <DataTableViewOptions table={table} />
        </div>
      </div>

      {/* Row 2: Faceted Filter + Active Criteria Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <DataTableFacetedFilter
          title="Status"
          icon={SecurityCheckIcon}
          options={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onValueChange={(val) => {
            setFilter("status", val);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
        />

        <DataTableCriteriaBar
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
      </div>

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
