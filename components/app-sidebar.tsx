"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
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
import { NavGroup } from "@/components/nav-group";
import { NavUser, type UserProps } from "@/components/nav-user";
import { SettingsDialog } from "@/components/settings-dialog";
import { mainNavItems, secondaryNavItems } from "@/lib/navigation";
import { useUserStore } from "@/stores/use-user-store";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "OP";
}

const DEFAULT_USER_PROPS: UserProps = {
  name: "Operator",
  username: "operator",
  initials: "OP",
};

export function AppSidebar() {
  const accountUser = useUserStore((state) => state.user);
  const setAccountUser = useUserStore((state) => state.setUser);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  const userProps: UserProps = React.useMemo(() => {
    if (!accountUser) return DEFAULT_USER_PROPS;
    return {
      name: accountUser.name,
      username: accountUser.username,
      initials: getInitials(accountUser.name),
    };
  }, [accountUser]);

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link href="/" />}>
                <Image
                  src="/logo.png"
                  alt="Mesto Logo"
                  width={32}
                  height={32}
                  className="size-8 object-contain rounded-md shrink-0"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Mesto</span>
                  <span className="truncate text-xs text-muted-foreground">Automations</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <NavGroup label="Main" items={mainNavItems} />
          <NavGroup
            label="Secondary"
            items={secondaryNavItems}
            onItemClick={(item) => {
              if (item.url === "#settings" || item.title === "Settings") {
                setIsSettingsOpen(true);
              }
            }}
            className="mt-auto"
          />
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={userProps} accountUser={accountUser} onUserUpdated={setAccountUser} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </>
  );
}
