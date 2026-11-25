"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  DataTableContent,
  DataTablePagination,
  DataTableToolbar,
  type DataTableFilterConfig,
  type FacetedFilterOption,
  useDataTable,
  endpointFetcher,
} from "@/components/data-table";
import {
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  SecurityCheckIcon,
  UserEdit01Icon,
} from "@hugeicons/core-free-icons";
import { appIcons } from "@/lib/icons";
import type { User } from "@/app/users/types";
import { columns } from "./columns";
import { type Ticket } from "./types";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending", icon: Clock01Icon },
  { value: "approved", label: "Approved", icon: CheckmarkCircle02Icon },
  { value: "rejected", label: "Rejected", icon: CancelCircleIcon },
];

export interface TicketsDataTableProps {
  mode: "automatic" | "manual";
}

export function TicketsDataTable({ mode }: TicketsDataTableProps) {
  const [creatorOptions, setCreatorOptions] = useState<FacetedFilterOption[]>([
    { label: "All Creators", value: "all", icon: appIcons.users },
  ]);

  useEffect(() => {
    let active = true;
    async function loadCreators() {
      try {
        const res = await axios.get<{ data: User[] }>("/api/users?all=true&sort=name.asc");
        if (!active) return;
        const users = res.data.data ?? [];
        setCreatorOptions([
          { label: "All Creators", value: "all", icon: appIcons.users },
          ...users.map((u) => ({
            idPrefix: `#${u.id}`,
            label: u.name,
            value: String(u.id),
          })),
        ]);
      } catch {
        // Non-fatal if creators fail to load
      }
    }
    loadCreators();
    return () => {
      active = false;
    };
  }, []);

  const dataTable = useDataTable<Ticket>({
    tableId: mode === "automatic" ? "automatic_tickets" : "manual_tickets",
    columns,
    fetchData: endpointFetcher(`/api/tickets/${mode}`),
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
      {
        key: "creator_id",
        title: "Creator",
        options: creatorOptions,
        categoryIcon: UserEdit01Icon,
        variant: "stone",
      },
    ],
    [creatorOptions],
  );

  return (
    <div className="flex flex-1 flex-col gap-2 min-w-0 min-h-0 h-full overflow-hidden p-1">
      {/* Primary Toolbar */}
      <DataTableToolbar
        instance={dataTable}
        searchPlaceholder={
          mode === "automatic" ? "Search automatic tickets..." : "Search manual tickets..."
        }
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
