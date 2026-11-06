"use client";

import { useEffect, useRef } from "react";
import { useDataTableStore } from "@/stores/use-data-table-store";
import type { TableItemState } from "@/lib/table-cookie";

export interface DataTableStoreInitializerProps {
  initialTables: Record<string, TableItemState>;
}

export function DataTableStoreInitializer({ initialTables }: DataTableStoreInitializerProps) {
  const initialized = useRef(false);

  if (!initialized.current) {
    useDataTableStore.getState().initFromCookies({
      tables: initialTables,
    });
    initialized.current = true;
  }

  useEffect(() => {
    useDataTableStore.getState().setHasHydrated(true);
  }, []);

  return null;
}
