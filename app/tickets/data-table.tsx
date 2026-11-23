"use client";

import { useMemo } from "react";
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
import { columns } from "./columns";
import { type Ticket } from "./types";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending", icon: Clock01Icon },
  { value: "approved", label: "Approved", icon: CheckmarkCircle02Icon },
  { value: "rejected", label: "Rejected", icon: CancelCircleIcon },
];

export function TicketsDataTable() {
  const dataTable = useDataTable<Ticket>({
    tableId: "tickets",
    columns,
    fetchData: endpointFetcher("/api/tickets"),
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
    </div>
  );
}
