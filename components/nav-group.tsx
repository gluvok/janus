"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { type NavItem } from "@/lib/navigation";

export interface NavGroupProps {
  label: string;
  items: NavItem[];
  onItemClick?: (item: NavItem) => void;
  className?: string;
}

export function NavGroup({ label, items, onItemClick, className }: NavGroupProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarGroup className={className}>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isAction = item.url.startsWith("#");
            const isActive = !isAction && pathname === item.url;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  onClick={() => {
                    if (isMobile) setOpenMobile(false);
                    if (isAction) onItemClick?.(item);
                  }}
                  {...(!isAction && { render: <Link href={item.url} /> })}
                  isActive={isActive}
                  tooltip={item.title}
                  className={cn(
                    isActive &&
                      "bg-primary/10 text-primary font-semibold hover:bg-primary/15 hover:text-primary dark:bg-primary/15 dark:text-primary-foreground [&>svg]:text-primary",
                  )}
                >
                  <HugeiconsIcon icon={item.icon} />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
