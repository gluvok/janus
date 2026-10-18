"use client";

import * as React from "react";
import axios from "axios";
import { toast } from "@/components/ui/toast";
import {
  DataTableContent,
  DataTableCriteriaBar,
  DataTableHydrationCard,
  DataTablePagination,
  DataTableSearchInput,
  DataTableRefreshButton,
  DataTableViewOptions,
  DatePickerWithRange,
  useDataTable,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  Calendar01Icon,
  HashtagIcon,
  PlusSignIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { getCustomerColumns } from "./columns";
import { CustomerFormDialog } from "./customer-form-dialog";
import { type Customer } from "./types";
import { getErrorMessage } from "@/lib/utils";

const TABLE_ID = "customers";

const COLUMN_LABELS: Record<string, string> = {
  id: "ID",
  name: "Name",
  created_at: "Created At",
};

const COLUMN_ICONS: Record<string, unknown> = {
  id: HashtagIcon,
  name: UserGroupIcon,
  created_at: Calendar01Icon,
};

export function CustomersDataTable() {
  const [formDialogOpen, setFormDialogOpen] = React.useState(false);
  const [editingCustomer, setEditingCustomer] = React.useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = React.useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleEdit = React.useCallback((customer: Customer) => {
    setEditingCustomer(customer);
    setFormDialogOpen(true);
  }, []);

  const handleDelete = React.useCallback((customer: Customer) => {
    setDeletingCustomer(customer);
  }, []);

  const columns = React.useMemo(
    () => getCustomerColumns({ onEdit: handleEdit, onDelete: handleDelete }),
    [handleEdit, handleDelete],
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
    refresh,
  } = useDataTable<Customer>({
    tableId: TABLE_ID,
    columns,
    endpoint: "/api/customers",
  });

  const confirmDelete = async () => {
    if (!deletingCustomer) return;
    setIsDeleting(true);
    try {
      await axios.delete("/api/customers", {
        data: { ids: [deletingCustomer.id] },
      });
      toast.add({
        type: "success",
        title: "Customer deleted",
        description: `Customer "${deletingCustomer.name}" deleted successfully.`,
      });
      setDeletingCustomer(null);
      refresh();
    } catch (err: unknown) {
      toast.add({
        type: "error",
        title: "Failed to delete customer",
        description: getErrorMessage(err, "Failed to delete customer"),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!hasHydrated) {
    return <DataTableHydrationCard />;
  }

  return (
    <div className="flex flex-1 flex-col gap-2 min-w-0 min-h-0 h-full overflow-hidden p-1">
      {/* Primary Toolbar */}
      <div className="flex flex-col gap-2 shrink-0 sm:flex-row sm:items-center sm:justify-between">
        {/* Filters Group (Left) */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
          <DataTableSearchInput
            placeholder="Search customers by name..."
            value={search}
            onChange={setSearch}
          />
        </div>

        {/* Action Controls Group (Right) */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            onClick={() => {
              setEditingCustomer(null);
              setFormDialogOpen(true);
            }}
            className="gap-1.5 text-xs h-8"
          >
            <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
            <span>Add Customer</span>
          </Button>

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

      {/* Active Criteria Bar (Drag-and-Drop Sort Priority Chips) */}
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
        columnLabels={COLUMN_LABELS}
        columnIcons={COLUMN_ICONS}
      />

      {/* Table Content Surface */}
      <DataTableContent table={table} loading={loading} error={error} />

      {/* Responsive Pagination Bar */}
      <DataTablePagination table={table} />

      {/* Customer Form Dialog */}
      <CustomerFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        customer={editingCustomer}
        onSuccess={refresh}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingCustomer}
        onOpenChange={(open) => {
          if (!open) setDeletingCustomer(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
            </div>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete customer &quot;{deletingCustomer?.name}&quot;? This
              action will soft-delete the customer profile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletingCustomer(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
