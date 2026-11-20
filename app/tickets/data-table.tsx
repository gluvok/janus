"use client";

import { useMemo, useState, useCallback } from "react";
import {
  DataTableContent,
  DataTablePagination,
  DataTableToolbar,
  type DataTableFilterConfig,
  useDataTable,
  endpointFetcher,
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

  const dataTable = useDataTable<Ticket>({
    tableId: "tickets",
    columns,
    fetchData: endpointFetcher("/api/tickets"),
    meta: tableMeta,
  });

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

  return (
    <div className="flex flex-1 flex-col gap-2 min-w-0 min-h-0 h-full overflow-hidden p-1">
      {/* Primary Toolbar */}
      <DataTableToolbar
        instance={dataTable}
        searchPlaceholder="Search tickets by concern or reply..."
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

      {/* Edit Ticket Dialog */}
      <TicketEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        ticket={editingTicket}
        onSuccess={dataTable.refresh}
      />

      {/* Delete Ticket Confirmation Dialog */}
      <TicketDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        ticket={deletingTicket}
        onSuccess={dataTable.refresh}
      />
    </div>
  );
}
