"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DataTableContent,
  DataTablePagination,
  DataTableToolbar,
  type DataTableFilterConfig,
  useDataTable,
} from "@/components/data-table";
import { Delete02Icon, SecurityCheckIcon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getColumns, type UsersTableMeta } from "./columns";
import { StaffUserDialog } from "./staff-user-dialog";
import { UserDeleteDialog } from "./delete-dialog";
import { ROLE_OPTIONS } from "./dialog-primitives";
import { type User } from "./types";

const ROLE_FILTER_OPTIONS = [{ value: "all", label: "All Roles" }, ...ROLE_OPTIONS];

export function UsersDataTable() {
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState<boolean>(false);
  const [usersToDelete, setUsersToDelete] = useState<User[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);

  const handleEditUser = useCallback((user: User) => {
    setSelectedUserForEdit(user);
    setFormDialogOpen(true);
  }, []);

  const handleDeleteUser = useCallback((user: User) => {
    setUsersToDelete([user]);
    setDeleteDialogOpen(true);
  }, []);

  const handleAddUser = useCallback(() => {
    setSelectedUserForEdit(null);
    setFormDialogOpen(true);
  }, []);

  const tableMeta = useMemo<UsersTableMeta>(
    () => ({
      onEditUser: handleEditUser,
      onDeleteUser: handleDeleteUser,
    }),
    [handleEditUser, handleDeleteUser],
  );

  const columns = useMemo(() => {
    return getColumns({
      showRole: true,
      entityLabel: "User",
    });
  }, []);

  const dataTable = useDataTable<User>({
    tableId: "users",
    columns,
    endpoint: "/api/users",
    meta: tableMeta,
  });

  const filterConfigs: DataTableFilterConfig[] = useMemo(
    () => [
      {
        key: "role",
        title: "Role",
        options: ROLE_FILTER_OPTIONS,
        categoryIcon: SecurityCheckIcon,
        variant: "stone",
      },
    ],
    [],
  );

  const handleBatchDelete = useCallback(() => {
    if (dataTable.selectedRows.length > 0) {
      setUsersToDelete(dataTable.selectedRows);
      setDeleteDialogOpen(true);
    }
  }, [dataTable.selectedRows]);

  const handleMutationSuccess = () => {
    dataTable.setRowSelection({});
    dataTable.refresh();
  };

  return (
    <div className="flex flex-1 flex-col gap-2 min-w-0 min-h-0 h-full overflow-hidden p-1">
      {/* Primary Toolbar */}
      <DataTableToolbar
        instance={dataTable}
        searchPlaceholder="Search users..."
        actions={
          <Button size="sm" onClick={handleAddUser} className="h-7 gap-1 px-2 text-2xs">
            <HugeiconsIcon icon={UserAdd01Icon} data-icon="inline-start" />
            <span>Add User</span>
          </Button>
        }
        filterConfigs={filterConfigs}
      />

      {/* Floating Bulk Action Bar */}
      {dataTable.selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-md border border-border/80 bg-muted/40 px-3 py-1.5 text-xs">
          <span className="font-medium text-muted-foreground">
            {dataTable.selectedCount} user{dataTable.selectedCount > 1 ? "s" : ""} selected
          </span>
          <Button variant="destructive" size="xs" onClick={handleBatchDelete} className="gap-1.5">
            <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
            <span>Delete Selected</span>
          </Button>
        </div>
      )}

      {/* Table Content Surface */}
      <DataTableContent
        table={dataTable.table}
        loading={dataTable.loading}
        error={dataTable.error}
        onRetry={dataTable.refresh}
      />

      {/* Responsive Pagination Bar */}
      <DataTablePagination table={dataTable.table} loading={dataTable.loading} />

      {/* Staff User Form Dialog */}
      <StaffUserDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        user={selectedUserForEdit}
        onSuccess={handleMutationSuccess}
      />

      {/* User Deletion Dialog */}
      <UserDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        users={usersToDelete}
        onSuccess={handleMutationSuccess}
      />
    </div>
  );
}
