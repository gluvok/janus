"use client";

import { usePathname } from "next/navigation";
import { getRouteTitle } from "@/lib/navigation";

export function AppBreadcrumb() {
  const pathname = usePathname();
  const title = getRouteTitle(pathname);

  return <span className="text-sm font-medium">{title}</span>;
}
