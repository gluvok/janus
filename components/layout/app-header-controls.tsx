"use client";

import { usePathname } from "next/navigation";
import { WeighmentModeToggle } from "@/app/weighments/weighment-mode-toggle";
import { useDataTableStore } from "@/stores/use-data-table-store";
import type { WeighmentMode } from "@/app/weighments/types";

export function AppHeaderControls() {
  const pathname = usePathname();
  const isWeighments = pathname.startsWith("/weighments");

  const mode = useDataTableStore(
    (state) => (state.tables["weighments"]?.mode ?? "automatic") as WeighmentMode,
  );
  const setTableMode = useDataTableStore((state) => state.setTableMode);

  if (!isWeighments) return null;

  return (
    <div className="flex items-center gap-2">
      <WeighmentModeToggle
        mode={mode}
        onModeChange={(newMode) => setTableMode("weighments", newMode)}
      />
    </div>
  );
}
