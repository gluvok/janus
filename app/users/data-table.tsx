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
import { CustomerUserDialog } from "./customer-user-dialog";

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
  username: TextFontIcon,
  name: UserIcon,
  role: SecurityCheckIcon,
  created_at: Calendar01Icon,
  updated_at: Clock01Icon,
};

interface EntityConfig {
  tableId: string;
  entityLabel: string;
  entityLabelPlural: string;
  searchPlaceholder: string;
  addButtonLabel: string;
  emptyMessage: string;
  hasRoleFilter: boolean;
  extraParams?: Record<string, string>;
  showRoleColumn: boolean;
  FormDialog: React.ComponentType<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user?: User | null;
    onSuccess: () => void;
  }>;
}

const ENTITY_CONFIG: Record<"staff" | "customer", EntityConfig> = {
  staff: {
    tableId: "users",
    entityLabel: "User",
    entityLabelPlural: "Users",
    searchPlaceholder: "Search staff accounts...",
    addButtonLabel: "Add Staff User",
    emptyMessage: "No staff accounts found matching the specified filters.",
    hasRoleFilter: true,
    extraParams: undefined,
    showRoleColumn: true,
    FormDialog: StaffUserDialog,
  },
  customer: {
    tableId: "customers",
    entityLabel: "Customer",
    entityLabelPlural: "Customers",
    searchPlaceholder: "Search customers...",
    addButtonLabel: "Add Customer",
    emptyMessage: "No customers found matching the specified filters.",
    hasRoleFilter: false,
    extraParams: { role: "customer" },
    showRoleColumn: false,
    FormDialog: CustomerUserDialog,
  },
};

interface UsersDataTableProps {
  roleScope: "staff" | "customer";
}

export function UsersDataTable({ roleScope }: UsersDataTableProps) {
  const config = ENTITY_CONFIG[roleScope];
  const { FormDialog } = config;

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

  const columns = useMemo(
    () => getColumns({ showRole: config.showRoleColumn, entityLabel: config.entityLabel }),
    [config.showRoleColumn, config.entityLabel],
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
    tableId: config.tableId,
    columns,
    endpoint: "/api/users",
    extraParams: config.extraParams,
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
        {/* Filters Group (Left) */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
          {/* Search Input with Clear Button */}
          <DataTableSearchInput
            placeholder={config.searchPlaceholder}
            value={search}
            onChange={setSearch}
          />

          {/* Faceted Role Filter (Staff view only) */}
          {config.hasRoleFilter && (
            <DataTableFacetedFilter
              title="Role"
              icon={SecurityCheckIcon}
              options={ROLE_OPTIONS}
              value={roleFilter}
              onValueChange={(val) => {
                setFilter("role", val);
              }}
            />
          )}
        </div>

        {/* Action Controls Group (Right) */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          {/* Batch Delete Button (shown when rows are selected) */}
          {selectedCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBatchDelete}
              className="h-8 gap-1.5 text-xs animate-in fade-in-0 duration-150"
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-3.5" data-icon="inline-start" />
              <span>Delete ({selectedCount})</span>
            </Button>
          )}

          {/* Add User / Customer Button */}
          <Button size="sm" onClick={handleAddUser} className="h-8 gap-1.5 text-xs">
            <HugeiconsIcon icon={UserAdd01Icon} className="size-3.5" data-icon="inline-start" />
            <span>{config.addButtonLabel}</span>
          </Button>

          {/* Refresh Button */}
          <DataTableRefreshButton onClick={refresh} loading={loading} />

          {/* Creation Date Range Picker */}
          <DatePickerWithRange
            date={dateRange}
            onDateChange={(range) => {
              setDateRange(range);
            }}
            className="flex-1 sm:flex-initial"
          />

          {/* Column Visibility Toggle */}
          <DataTableViewOptions table={table} />
        </div>
      </div>

      {/* Criteria Bar: Drag-and-drop sort priority chips */}
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
        columnLabels={COLUMN_LABELS}
        columnIcons={COLUMN_ICONS}
        onResetSorts={resetSorting}
        onResetAll={resetAllCriteria}
      />

      {/* Main Datatable Surface */}
      <DataTableContent
        table={table}
        loading={loading}
        error={error}
        onRetry={refresh}
        emptyMessage={config.emptyMessage}
      />

      {/* Pagination Controls */}
      <div className="shrink-0">
        <DataTablePagination table={table} loading={loading} error={error} />
      </div>

      {/* Add / Edit User Form Modal (Dedicated Component) */}
      <FormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        user={selectedUserForEdit}
        onSuccess={handleMutationSuccess}
      />

      {/* Delete User Confirmation Modal */}
      <UserDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        users={usersToDelete}
        onSuccess={handleMutationSuccess}
        entityLabel={config.entityLabel}
        entityLabelPlural={config.entityLabelPlural}
      />
    </div>
  );
}
