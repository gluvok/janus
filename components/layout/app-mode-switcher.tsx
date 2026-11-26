"use client";

import { type ComponentProps, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { CpuIcon, UserEdit01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { type EntityMode, useModeStore } from "@/stores/use-mode-store";
import { parseModeRoute } from "./app-breadcrumb";

const MODE_OPTIONS: Array<{
  value: EntityMode;
  label: string;
  icon: ComponentProps<typeof HugeiconsIcon>["icon"];
}> = [
  { value: "automatic", label: "Automatic", icon: CpuIcon },
  { value: "manual", label: "Manual", icon: UserEdit01Icon },
];

export function AppModeSwitcher() {
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
    return null;
  }

  const currentMode = modeRoute.urlMode ?? storedMode;

  const handleModeChange = (value: unknown) => {
    if (value !== "automatic" && value !== "manual") return;
    setMode(modeRoute.entity, value);
    router.push(`/${modeRoute.entity}/${value}`);
  };

  return (
    <div
      role="radiogroup"
      aria-label={`${modeRoute.title} mode`}
      className="inline-flex w-auto items-center gap-0.5 rounded-lg border border-border/70 bg-muted/40 p-0.5"
    >
      {MODE_OPTIONS.map((option) => {
        const isSelected = currentMode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => handleModeChange(option.value)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all",
              isSelected
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <HugeiconsIcon
              icon={option.icon}
              className={cn("size-3.5 shrink-0", isSelected && "text-primary")}
            />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
