"use client";

import { useState } from "react";
import {
  DataTableContent,
  DataTablePagination,
  DataTableToolbar,
  useDataTable,
} from "@/components/data-table";
import { columns } from "./columns";
import { CenterEditDialog } from "./edit-dialog";
import { type Center } from "./types";

const TABLE_ID = "centers";

export function CentersDataTable() {
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);

  const dataTable = useDataTable<Center>({
    tableId: TABLE_ID,
    columns,
    endpoint: "/api/centers",
    meta: {
      onEditCenter: setEditingCenter,
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-2 min-w-0 min-h-0 h-full overflow-hidden p-1">
      {/* Primary Toolbar */}
      <DataTableToolbar instance={dataTable} searchPlaceholder="Search centers..." />

      {/* Reusable Data Table Content */}
      <DataTableContent
        table={dataTable.table}
        loading={dataTable.loading}
        error={dataTable.error}
        onRetry={dataTable.refresh}
        emptyMessage="No centers found matching the specified filters."
      />

      {/* Pagination Controls */}
      <div className="shrink-0">
        <DataTablePagination
          table={dataTable.table}
          loading={dataTable.loading}
          error={dataTable.error}
        />
      </div>

      {/* Center Edit Dialog */}
      {editingCenter && (
        <CenterEditDialog
          open={true}
          onOpenChange={(open) => !open && setEditingCenter(null)}
          center={editingCenter}
          onSuccess={dataTable.refresh}
        />
      )}
    </div>
  );
}
