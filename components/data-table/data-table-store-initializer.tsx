"use client";

import { useEffect, useRef } from "react";
import { useDataTableStore } from "@/stores/use-data-table-store";
import type { TableItemState, GlobalMode } from "@/lib/table-cookie";

export interface DataTableStoreInitializerProps {
  initialTables: Record<string, TableItemState>;
  initialGlobalMode: GlobalMode;
}

export function DataTableStoreInitializer({
  initialTables,
  initialGlobalMode,
}: DataTableStoreInitializerProps) {
  const initialized = useRef(false);

  if (!initialized.current) {
    useDataTableStore.getState().initFromCookies({
      tables: initialTables,
      initialGlobalMode,
    });
    initialized.current = true;
  }

  useEffect(() => {
    useDataTableStore.getState().setHasHydrated(true);
  }, []);

  return null;
}
