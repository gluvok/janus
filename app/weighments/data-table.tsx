"use client";

import { useDataTableStore } from "@/stores/use-data-table-store";
import type { WeighmentMode } from "./types";
import { AutomaticWeighmentsDataTable } from "./automatic-data-table";
import { ManualWeighmentsDataTable } from "./manual-data-table";

export function WeighmentsDataTable() {
  const mode = useDataTableStore(
    (state) => (state.tables["weighments"]?.mode ?? "automatic") as WeighmentMode,
  );

  return mode === "manual" ? <ManualWeighmentsDataTable /> : <AutomaticWeighmentsDataTable />;
}
