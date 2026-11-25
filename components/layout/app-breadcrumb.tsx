"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getRouteTitle } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { type EntityMode, type ModeEntity, useModeStore } from "@/stores/use-mode-store";

const MODE_ENTITY_TITLES: Record<ModeEntity, string> = {
  entries: "Entries",
  weighments: "Weighments",
  tickets: "Tickets",
};

const MODE_OPTIONS: Array<{ value: EntityMode; label: string }> = [
  { value: "automatic", label: "Automatic" },
  { value: "manual", label: "Manual" },
];

function parseModeRoute(pathname: string | null | undefined): {
  entity: ModeEntity;
  title: string;
  urlMode: EntityMode | null;
} | null {
  if (!pathname) return null;
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first !== "entries" && first !== "weighments" && first !== "tickets") {
    return null;
  }
  const second = segments[1];
  const urlMode: EntityMode | null = second === "automatic" || second === "manual" ? second : null;
  return {
    entity: first,
    title: MODE_ENTITY_TITLES[first],
    urlMode,
  };
}

export function AppBreadcrumb() {
  const pathname = usePathname();
  const router = useRouter();
  const modeRoute = parseModeRoute(pathname);
  const storedMode = useModeStore((state) =>
    modeRoute ? state.modes[modeRoute.entity] : "automatic",
  );
  const setMode = useModeStore((state) => state.setMode);

  useEffect(() => {
    if (!modeRoute?.urlMode) return;
    if (useModeStore.getState().modes[modeRoute.entity] !== modeRoute.urlMode) {
      setMode(modeRoute.entity, modeRoute.urlMode);
    }
  }, [modeRoute?.entity, modeRoute?.urlMode, setMode]);

  if (!modeRoute) {
    return <span className="text-sm font-medium">{getRouteTitle(pathname)}</span>;
  }

  const currentMode = modeRoute.urlMode ?? storedMode;

  const handleModeChange = (value: unknown) => {
    if (value !== "automatic" && value !== "manual") return;
    setMode(modeRoute.entity, value);
    router.push(`/${modeRoute.entity}/${value}`);
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium">{modeRoute.title}</span>
      <RadioGroup
        value={currentMode}
        onValueChange={handleModeChange}
        aria-label={`${modeRoute.title} mode`}
        className="flex w-auto items-center gap-1 rounded-lg border border-border/70 bg-muted/40 p-0.5"
      >
        {MODE_OPTIONS.map((option) => {
          const itemId = `${modeRoute.entity}-mode-${option.value}`;
          const isSelected = currentMode === option.value;
          return (
            <Label
              key={option.value}
              htmlFor={itemId}
              className={cn(
                "cursor-pointer gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                isSelected
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <RadioGroupItem value={option.value} id={itemId} />
              <span>{option.label}</span>
            </Label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
