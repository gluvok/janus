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
import { NotificationBell } from "@/components/notification-bell";
import { AUTH_ROUTES } from "@/lib/constants";
import { useAuthStore } from "@/lib/store";

/**
 * MainLayout Component
 * Conditionally wraps page content based on authentication state and active route type.
 * Adds the AppSidebar structure for authorized dashboard routes.
 */
export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_ROUTES.includes(pathname);
  const user = useAuthStore((state) => state.user);

  if (isAuthPage) {
    return <AuthGuard>{children}</AuthGuard>;
  }

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen={!!user}>
        <AppSidebar />
        <SidebarInset>
          {children}
          {/* Sits in the h-16 header band every page renders; no page header uses its right side. */}
          <div className="fixed top-5 right-6 z-40">
            <NotificationBell />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}
