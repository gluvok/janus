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
  useSidebar,
} from "@/components/ui/sidebar";
import { NavGroup } from "./nav-group";
import { NavUser, type UserProps } from "./nav-user";
import { AccountDialog } from "@/components/account-dialog";
import { SettingsDialog } from "@/components/settings-dialog";
import { operationsNavItems, managementNavItems, systemNavItems } from "@/lib/navigation";
import { useUserStore } from "@/stores/use-user-store";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "OP";
}

export function AppSidebar() {
  const accountUser = useUserStore((state) => state.user);
  const setAccountUser = useUserStore((state) => state.setUser);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isAccountOpen, setIsAccountOpen] = React.useState(false);
  const { isMobile, setOpenMobile } = useSidebar();

  const userProps: UserProps | null = React.useMemo(() => {
    if (!accountUser) return null;
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
              <SidebarMenuButton
                size="lg"
                render={<Link href="/" />}
                onClick={() => {
                  if (isMobile) setOpenMobile(false);
                }}
              >
                <Image
                  src="/logo.png"
                  alt="Mesto Logo"
                  width={32}
                  height={32}
                  className="size-8 object-contain rounded-md shrink-0 dark:bg-[#f4efe4]/90 dark:p-1"
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
          <NavGroup label="Operations" items={operationsNavItems} />
          <NavGroup label="Management" items={managementNavItems} />
          <NavGroup
            label="System"
            items={systemNavItems}
            onItemClick={(item) => {
              if (isMobile) setOpenMobile(false);
              if (item.url === "#settings" || item.title === "Settings") {
                setIsSettingsOpen(true);
              }
            }}
            className="mt-auto"
          />
        </SidebarContent>
        <SidebarFooter>
          {accountUser && userProps && (
            <NavUser user={userProps} onOpenAccount={() => setIsAccountOpen(true)} />
          )}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      {accountUser && (
        <AccountDialog
          open={isAccountOpen}
          onOpenChange={setIsAccountOpen}
          user={accountUser}
          onUserUpdated={setAccountUser}
        />
      )}

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </>
  );
}
