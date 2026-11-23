"use client";

/**
 * @file app/page.tsx
 * @description Main dashboard page component.
 * Displays authorized projects/tables in a grid configuration based on RBAC matrix filters.
 */

import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LayoutDashboard } from "lucide-react";
import { PROJECTS } from "@/lib/projects";
import { DashboardCard } from "@/components/dashboard";
import { useAuthStore, hasPageAccess } from "@/lib/store";

export default function Page() {
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);

  // Filters projects dynamically based on user role authorization and hydration state
  const filteredProjects = React.useMemo(() => {
    if (!hydrated || !user) return [];
    return PROJECTS.filter((p) => hasPageAccess(user.role, p.slug));
  }, [hydrated, user]);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger id="sidebar-trigger-home" className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="flex items-center gap-1.5 font-medium">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Home
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <main className="p-8 w-full min-w-0 space-y-8">
        <div className="space-y-2 flex flex-col items-start text-left">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm max-w-xl">
            Welcome back. Access the platform tools, manage entities, and track operations.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredProjects.map((project) => (
            <DashboardCard
              key={project.slug}
              name={project.name}
              href={`/projects/${project.slug}`}
              desc={project.desc}
              icon={project.icon}
              color={project.color}
              theme={project.theme}
            />
          ))}
        </div>
      </main>
    </>
  );
}
