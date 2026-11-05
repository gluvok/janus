import { appIcons } from "@/lib/icons";
import type { ComponentProps } from "react";
import type { HugeiconsIcon } from "@hugeicons/react";

export interface NavItem {
  title: string;
  url: string;
  icon: ComponentProps<typeof HugeiconsIcon>["icon"];
  description?: string;
}

export const mainNavItems: NavItem[] = [
  {
    title: "Weighments",
    url: "/weighments",
    icon: appIcons.weighments,
    description: "Track weighbridge measurements, gross, tare, and net weights.",
  },
  {
    title: "Centers",
    url: "/centers",
    icon: appIcons.centers,
    description: "Manage processing facilities and operational locations.",
  },
  {
    title: "Users",
    url: "/users",
    icon: appIcons.users,
    description: "Configure system operators, roles, and access credentials.",
  },
  {
    title: "Tickets",
    url: "/tickets",
    icon: appIcons.tickets,
    description: "Support tickets and issue tracking.",
  },
];

export const secondaryNavItems: NavItem[] = [
  {
    title: "Settings",
    url: "#settings",
    icon: appIcons.settings,
    description: "Platform preferences, system defaults, and configurations.",
  },
  {
    title: "Support",
    url: "/support",
    icon: appIcons.support,
    description: "Technical assistance and helpdesk.",
  },
  {
    title: "Services",
    url: "/services",
    icon: appIcons.services,
    description: "System services and external integrations.",
  },
];

const allNavItems: NavItem[] = [...mainNavItems, ...secondaryNavItems];

const routeTitleMap: Record<string, string> = allNavItems.reduce(
  (acc, item) => {
    acc[item.url] = item.title;
    return acc;
  },
  { "/": "Home" } as Record<string, string>,
);

export function getRouteTitle(pathname: string | null | undefined): string {
  if (!pathname) return "Home";
  return routeTitleMap[pathname] || "Home";
}
