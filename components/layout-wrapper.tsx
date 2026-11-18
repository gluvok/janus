"use client";

/**
 * @file components/layout-wrapper.tsx
 * @description Layout wrapper component for the application.
 * Manages route guarding, main layouts, and sidebar rendering.
 */

import * as React from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AuthGuard } from "@/components/auth/guard";
import { AUTH_ROUTES } from "@/lib/constants";
import { useAuthStore } from "@/lib/store";
import { useEntryNotifications } from "@/hooks/use-entry-notifications";

/**
 * MainLayout Component
 * Conditionally wraps page content based on authentication state and active route type.
 * Adds the AppSidebar structure for authorized dashboard routes.
 */
export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_ROUTES.includes(pathname);
  const user = useAuthStore((state) => state.user);

  useEntryNotifications();

  if (isAuthPage) {
    return <AuthGuard>{children}</AuthGuard>;
  }

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen={!!user}>
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}
