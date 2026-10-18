"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import axios from "axios";
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
import { type User } from "@/app/users/types";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "US";
}

const DEFAULT_USER_PROPS: UserProps = {
  name: "Admin Factory 1",
  email: "admin1@gluvok.com",
  initials: "AF",
};

export function AppSidebar() {
  const [accountUser, setAccountUser] = React.useState<User | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    axios
      .get<{ data: User }>("/api/users/me")
      .then((res) => {
        if (mounted && res.data?.data) {
          setAccountUser(res.data.data);
        }
      })
      .catch(() => {
        // Fallback silently to default user props
      });
    return () => {
      mounted = false;
    };
  }, []);

  const userProps: UserProps = React.useMemo(() => {
    if (!accountUser) return DEFAULT_USER_PROPS;
    return {
      name: accountUser.name,
      email: `${accountUser.username ?? "admin"}@gluvok.com`,
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
