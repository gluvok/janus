"use client";

/**
 * @file components/sidebar/app-sidebar.tsx
 * @description Main application sidebar wrapper.
 * Houses headers, platform logo, main navigation routes, secondary links, and the logged-in user block.
 */

import * as React from "react";
import Link from "next/link";
import { Logo, LogoHorizontal } from "@/components/logo";

import { NavMain } from "./nav/main";
import { NavSecondary } from "./nav/secondary";
import { NavUser } from "./nav/user";
import { SIDEBAR_DATA } from "./data";
import { useAuthStore, hasPageAccess } from "@/lib/store";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

/**
 * AppSidebar Component
 * Sidebar navigation tree. Applies user-role filters to selectively render projects/features.
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);

  const activeUser = {
    name: user?.name || SIDEBAR_DATA.user.name,
    username: user?.username || SIDEBAR_DATA.user.username,
    role: user?.role || SIDEBAR_DATA.user.role,
    avatar: user?.avatar || SIDEBAR_DATA.user.avatar,
  };

  const filteredNavMain = React.useMemo(() => {
    if (!hydrated || !user) return [];
    return SIDEBAR_DATA.navMain.filter((item) => {
      const slug = item.url.split("/").pop() || "";
      return hasPageAccess(user.role, slug);
    });
  }, [hydrated, user]);

  return (
    <Sidebar variant="sidebar" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <LogoHorizontal size={64} className="group-data-[collapsible=icon]:hidden" />
                <Logo size={24} className="hidden group-data-[collapsible=icon]:block" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={filteredNavMain} />
        <NavSecondary items={SIDEBAR_DATA.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={activeUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
