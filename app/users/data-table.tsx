"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DataTableContent,
  DataTablePagination,
  DataTableToolbar,
  type DataTableFilterConfig,
  useDataTable,
  endpointFetcher,
} from "@/components/data-table";
import { Delete02Icon, SecurityCheckIcon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getColumns, type UsersTableMeta } from "./columns";
import { CreateUserDialog, EditUserDialog } from "./staff-user-dialog";
import { SingleUserDeleteDialog, BatchUsersDeleteDialog } from "./delete-dialog";
import { ROLE_OPTIONS } from "./dialog-primitives";
import { type User } from "./types";

const ROLE_FILTER_OPTIONS = [{ value: "all", label: "All Roles" }, ...ROLE_OPTIONS];

export function UsersDataTable() {
  const [createUserOpen, setCreateUserOpen] = useState<boolean>(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [batchUsersToDelete, setBatchUsersToDelete] = useState<User[]>([]);

  const handleEditUser = useCallback((user: User) => {
    setUserToEdit(user);
  }, []);

  const handleDeleteUser = useCallback((user: User) => {
    setUserToDelete(user);
  }, []);

  const handleAddUser = useCallback(() => {
    setCreateUserOpen(true);
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
    fetchData: endpointFetcher("/api/users"),
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
      setBatchUsersToDelete(dataTable.selectedRows);
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
              variant="destructive"
              size="xs"
              onClick={handleBatchDelete}
              className="h-6 gap-1.5 text-2xs"
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
              <span>Delete Selected</span>
            </Button>
          </div>
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

      {/* Create User Dialog */}
      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        onSuccess={handleMutationSuccess}
      />

      {/* Edit User Dialog */}
      {userToEdit && (
        <EditUserDialog
          open={Boolean(userToEdit)}
          onOpenChange={(open) => {
            if (!open) setUserToEdit(null);
          }}
          user={userToEdit}
          onSuccess={handleMutationSuccess}
        />
      )}

      {/* Single User Deletion Dialog */}
      <SingleUserDeleteDialog
        open={Boolean(userToDelete)}
        onOpenChange={(open) => {
          if (!open) setUserToDelete(null);
        }}
        user={userToDelete}
        onSuccess={handleMutationSuccess}
      />

      {/* Batch Users Deletion Dialog */}
      <BatchUsersDeleteDialog
        open={batchUsersToDelete.length > 0}
        onOpenChange={(open) => {
          if (!open) setBatchUsersToDelete([]);
        }}
        users={batchUsersToDelete}
        onSuccess={handleMutationSuccess}
      />
    </div>
  );
}
