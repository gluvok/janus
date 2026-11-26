"use client";

import { usePathname } from "next/navigation";
import { getRouteTitle } from "@/lib/navigation";
import type { EntityMode, ModeEntity } from "@/stores/use-mode-store";

const MODE_ENTITY_TITLES: Record<ModeEntity, string> = {
  entries: "Entries",
  weighments: "Weighments",
};

export function parseModeRoute(pathname: string | null | undefined): {
  entity: ModeEntity;
  title: string;
  urlMode: EntityMode | null;
} | null {
  if (!pathname) return null;
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first !== "entries" && first !== "weighments") {
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
  const modeRoute = parseModeRoute(pathname);
  const title = modeRoute ? modeRoute.title : getRouteTitle(pathname);

  return <span className="truncate text-sm font-medium">{title}</span>;
}
