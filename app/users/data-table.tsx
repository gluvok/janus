"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DataTableSearchInput,
  DataTableFacetedFilter,
  type FacetedFilterOption,
  DataTableCriteriaBar,
  DataTableContent,
  DataTablePagination,
  DataTableRefreshButton,
  DataTableViewOptions,
  DatePickerWithRange,
  DataTableHydrationCard,
  useDataTable,
} from "@/components/data-table";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Briefcase01Icon,
  Calendar01Icon,
  Clock01Icon,
  CrownIcon,
  Delete02Icon,
  HashtagIcon,
  HeadsetIcon,
  SecurityCheckIcon,
  TextFontIcon,
  UserAdd01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { getColumns, type UsersTableMeta } from "./columns";
import { type User } from "./types";
import { UserDeleteDialog } from "./user-delete-dialog";
import { StaffUserDialog } from "./staff-user-dialog";

const ROLE_OPTIONS: FacetedFilterOption[] = [
  { label: "All Roles", value: "all", icon: SecurityCheckIcon },
  { label: "Admin", value: "admin", icon: CrownIcon },
  { label: "Manager", value: "manager", icon: Briefcase01Icon },
  { label: "Operator", value: "operator", icon: HeadsetIcon },
  { label: "Base", value: "base", icon: UserIcon },
];

const COLUMN_LABELS: Record<string, string> = {
  id: "ID",
  username: "Username",
  name: "Full Name",
  role: "Role",
  created_at: "Created At",
  updated_at: "Updated At",
};

const COLUMN_ICONS: Record<string, unknown> = {
  id: HashtagIcon,
  username: UserIcon,
  name: TextFontIcon,
  role: SecurityCheckIcon,
  created_at: Calendar01Icon,
  updated_at: Clock01Icon,
};

export function UsersDataTable() {
  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState<boolean>(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [usersToDelete, setUsersToDelete] = useState<User[]>([]);

  // Handle edit user trigger from row action
  const handleEditUser = useCallback((user: User) => {
    setSelectedUserForEdit(user);
    setFormDialogOpen(true);
  }, []);

  // Handle single delete user trigger from row action
  const handleDeleteUser = useCallback((user: User) => {
    setUsersToDelete([user]);
    setDeleteDialogOpen(true);
  }, []);

  // Table meta callbacks passed down to row actions
  const tableMeta = useMemo<UsersTableMeta>(
    () => ({
      onEditUser: handleEditUser,
      onDeleteUser: handleDeleteUser,
    }),
    [handleEditUser, handleDeleteUser],
  );

  const columns = useMemo(() => getColumns({ showRole: true, entityLabel: "User" }), []);

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
    setRowSelection,
    selectedRows,
    selectedCount,
    hasActiveSorts,
    resetAllCriteria,
    resetSorting,
    setFilter,
    refresh,
    tableState,
  } = useDataTable<User>({
    tableId: "users",
    columns,
    endpoint: "/api/users",
    meta: tableMeta,
  });

  const roleFilter = tableState.filters["role"] ?? "all";

  const handleAddUser = () => {
    setSelectedUserForEdit(null);
    setFormDialogOpen(true);
  };

  const handleBatchDelete = () => {
    if (selectedCount === 0) return;
    setUsersToDelete(selectedRows);
    setDeleteDialogOpen(true);
  };

  const handleMutationSuccess = () => {
    setRowSelection({});
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
          <DataTableSearchInput placeholder="Search users..." value={search} onChange={setSearch} />
        </div>

        {/* Action Controls Group (Right) */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          {/* Add User Button */}
          <Button size="sm" onClick={handleAddUser} className="h-7 gap-1 px-2 text-2xs">
            <HugeiconsIcon icon={UserAdd01Icon} data-icon="inline-start" />
            <span>Add User</span>
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

      {/* Row 2: Faceted Filter + Active Criteria Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <DataTableFacetedFilter
          title="Role"
          icon={SecurityCheckIcon}
          options={ROLE_OPTIONS}
          value={roleFilter}
          onValueChange={(val) => {
            setFilter("role", val);
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
          columnLabels={COLUMN_LABELS}
          columnIcons={COLUMN_ICONS}
        />
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-md border border-border/80 bg-muted/40 px-3 py-1.5 text-xs">
          <span className="font-medium text-muted-foreground">
            {selectedCount} user{selectedCount > 1 ? "s" : ""} selected
          </span>
          <Button variant="destructive" size="xs" onClick={handleBatchDelete} className="gap-1.5">
            <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
            <span>Delete Selected</span>
          </Button>
        </div>
      )}

      {/* Table Content Surface */}
      <DataTableContent table={table} loading={loading} error={error} />

      {/* Responsive Pagination Bar */}
      <DataTablePagination table={table} />

      {/* Staff User Form Dialog */}
      <StaffUserDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        user={selectedUserForEdit}
        onSuccess={handleMutationSuccess}
      />

      {/* Delete User Dialog */}
      <UserDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        users={usersToDelete}
        onSuccess={handleMutationSuccess}
      />
    </div>
  );
}
