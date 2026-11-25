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
  Building02Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  SecurityCheckIcon,
  UserCheck01Icon,
  UserEdit01Icon,
} from "@hugeicons/core-free-icons";
import { appIcons } from "@/lib/icons";
import type { Center } from "@/app/centers/types";
import type { User } from "@/app/users/types";
import type { EntityMode } from "@/stores/use-mode-store";
import { getTicketColumns } from "./columns";
import { type Ticket } from "./types";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending", icon: Clock01Icon },
  { value: "approved", label: "Approved", icon: CheckmarkCircle02Icon },
  { value: "rejected", label: "Rejected", icon: CancelCircleIcon },
];

export interface TicketsDataTableProps {
  mode: EntityMode;
}

function TicketsDataTableInner({ mode }: TicketsDataTableProps) {
  const [centerOptions, setCenterOptions] = useState<FacetedFilterOption[]>([
    { label: "All Centers", value: "all", icon: appIcons.centers },
  ]);
  const [creatorOptions, setCreatorOptions] = useState<FacetedFilterOption[]>([
    { label: "All Creators", value: "all", icon: appIcons.users },
  ]);
  const [entryCreatorOptions, setEntryCreatorOptions] = useState<FacetedFilterOption[]>([
    { label: "All Entry Creators", value: "all", icon: appIcons.users },
  ]);

  useEffect(() => {
    let active = true;
    async function loadCenters() {
      try {
        const res = await axios.get<{ data: Center[] }>("/api/centers?all=true&sort=name.asc");
        if (!active) return;
        const centers = res.data.data ?? [];
        setCenterOptions([
          { label: "All Centers", value: "all", icon: appIcons.centers },
          ...centers.map((c) => ({
            idPrefix: `#${c.id}`,
            label: c.name,
            value: String(c.id),
          })),
        ]);
      } catch {
        // Non-fatal if centers fail to load
      }
    }
    async function loadUsers() {
      try {
        const res = await axios.get<{ data: User[] }>("/api/users?all=true&sort=name.asc");
        if (!active) return;
        const users = res.data.data ?? [];
        const mapped = users.map((u) => ({
          idPrefix: `#${u.id}`,
          label: u.name,
          value: String(u.id),
        }));
        setCreatorOptions([
          { label: "All Creators", value: "all", icon: appIcons.users },
          ...mapped,
        ]);
        setEntryCreatorOptions([
          { label: "All Entry Creators", value: "all", icon: appIcons.users },
          ...mapped,
        ]);
      } catch {
        // Non-fatal if creators fail to load
      }
    }
    loadCenters();
    loadUsers();
    return () => {
      active = false;
    };
  }, []);

  const columns = useMemo(() => getTicketColumns(mode), [mode]);
  const fetchData = useMemo(() => endpointFetcher<Ticket>(`/api/tickets/${mode}`), [mode]);
  const tableId = mode === "automatic" ? "automatic_tickets" : "manual_tickets";

  const dataTable = useDataTable<Ticket>({
    tableId,
    columns,
    fetchData,
  });

  const filterConfigs: DataTableFilterConfig[] = useMemo(() => {
    const configs: DataTableFilterConfig[] = [
      {
        key: "status",
        title: "Status",
        options: STATUS_FILTER_OPTIONS,
        categoryIcon: SecurityCheckIcon,
        variant: "stone",
      },
      {
        key: "center_id",
        title: "Center",
        options: centerOptions,
        categoryIcon: Building02Icon,
        variant: "stone",
      },
      {
        key: "creator_id",
        title: "Creator",
        options: creatorOptions,
        categoryIcon: UserEdit01Icon,
        variant: "stone",
      },
    ];
    if (mode === "manual") {
      configs.push({
        key: "entry_creator_id",
        title: "Entry Creator",
        options: entryCreatorOptions,
        categoryIcon: UserCheck01Icon,
        variant: "stone",
      });
    }
    return configs;
  }, [centerOptions, creatorOptions, entryCreatorOptions, mode]);

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

export function TicketsDataTable({ mode }: TicketsDataTableProps) {
  return <TicketsDataTableInner key={mode} mode={mode} />;
}
