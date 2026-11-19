/**
 * @file components/projects/header.tsx
 * @description Header component for project/table view pages.
 * Displays breadcrumb navigation and the sidebar toggle button.
 */

import * as React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { NotificationBox } from "@/components/notifications/notification-box";

interface ProjectHeaderProps {
  projectSlug: string;
  projectName: string;
  Icon: React.ComponentType<{ className?: string }>;
}

/**
 * ProjectHeader Component
 * Renders the top navigation bar for dynamic tables, featuring breadcrumbs back to dashboard and icons.
 */
export function ProjectHeader({ projectSlug, projectName, Icon }: ProjectHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger id={`sidebar-trigger-${projectSlug}`} className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-vertical:h-4 data-vertical:self-auto"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  id={`breadcrumb-home-${projectSlug}`}
                  href="/"
                  className="flex items-center gap-1"
                >
                  <LayoutDashboard className="h-3 w-3" /> Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="flex items-center gap-1 font-medium text-foreground">
                <Icon className="h-3 w-3" /> {projectName}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center">
        <NotificationBox />
      </div>
    </header>
  );
}
