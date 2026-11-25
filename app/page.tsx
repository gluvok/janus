"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { operationsNavItems, managementNavItems, type NavItem } from "@/lib/navigation";
import { ArrowRight01Icon, Factory01Icon } from "@hugeicons/core-free-icons";
import { useFactoryStore } from "@/stores/use-factory-store";
import { cn } from "@/lib/utils";

interface ModuleConfig {
  category: string;
  accentClass: string;
  actionLabel: string;
}

const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  Weighments: {
    category: "Operations",
    accentClass:
      "text-amber-900 bg-amber-600/10 border-amber-300/40 dark:text-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40",
    actionLabel: "View weighments",
  },
  Entries: {
    category: "Scale",
    accentClass:
      "text-emerald-900 bg-emerald-600/10 border-emerald-300/40 dark:text-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/40",
    actionLabel: "View entries",
  },
  Centers: {
    category: "Facilities",
    accentClass:
      "text-blue-900 bg-blue-600/10 border-blue-300/40 dark:text-blue-200 dark:bg-blue-950/30 dark:border-blue-800/40",
    actionLabel: "Manage centers",
  },
  Users: {
    category: "Access",
    accentClass:
      "text-violet-900 bg-violet-600/10 border-violet-300/40 dark:text-violet-200 dark:bg-violet-950/30 dark:border-violet-800/40",
    actionLabel: "Manage users",
  },
  Tickets: {
    category: "Support",
    accentClass:
      "text-rose-900 bg-rose-600/10 border-rose-300/40 dark:text-rose-200 dark:bg-rose-950/30 dark:border-rose-800/40",
    actionLabel: "View tickets",
  },
};

const DEFAULT_MODULE_CONFIG: ModuleConfig = {
  category: "General",
  accentClass: "text-foreground bg-muted border-border",
  actionLabel: "View module",
};

const dashboardNavItems: NavItem[] = [...operationsNavItems, ...managementNavItems];

export default function Home() {
  const factory = useFactoryStore((state) => state.factory);

  if (!factory) {
    return null;
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-6 overflow-y-auto p-1">
      {/* Top Welcome Header with Factory Badge */}
      <div className="flex flex-col gap-3 pb-2 border-b border-border/50 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold tracking-tight font-heading text-foreground">
            Operational Dashboard
          </h1>
          <p className="text-xs text-muted-foreground">
            Centralized automation and weighment management platform.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start rounded-lg border border-stone-300/80 bg-stone-500/5 px-3 py-1.5 text-xs font-medium text-stone-800 shadow-2xs sm:self-auto dark:border-stone-700/80 dark:bg-stone-900/30 dark:text-stone-200">
          <HugeiconsIcon
            icon={Factory01Icon}
            className="size-4 text-stone-600 dark:text-stone-400"
          />
          <span>{factory.name}</span>
        </div>
      </div>

      {/* Core Operational Module Cards (Responsive Grid Layout) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {dashboardNavItems.map((section: NavItem) => {
          const config = MODULE_CONFIGS[section.title] ?? DEFAULT_MODULE_CONFIG;

          return (
            <Link key={section.title} href={section.url} className="group outline-none flex">
              <Card className="flex flex-col justify-between gap-0 py-0 w-full border border-border/80 bg-card/70 transition-all duration-200 hover:border-primary/40 hover:bg-card hover:shadow-xs cursor-pointer rounded-xl overflow-hidden">
                <CardHeader className="p-3 pb-0 space-y-0 flex flex-row items-center justify-between">
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg border transition-transform duration-200 group-hover:scale-105",
                      config.accentClass,
                    )}
                  >
                    <HugeiconsIcon icon={section.icon} className="size-4.5" />
                  </div>
                  <span className="rounded-md border border-stone-300/60 bg-stone-500/5 px-2 py-0.5 text-2xs font-medium text-muted-foreground dark:border-stone-700/60 dark:bg-stone-900/20">
                    {config.category}
                  </span>
                </CardHeader>
                <CardContent className="px-3 pt-2 pb-2 space-y-1 flex-1">
                  <CardTitle className="text-sm font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
                    {section.title}
                  </CardTitle>
                  {section.description && (
                    <CardDescription className="text-2xs text-muted-foreground leading-relaxed line-clamp-2">
                      {section.description}
                    </CardDescription>
                  )}
                </CardContent>
                <CardFooter className="px-3 pt-0 pb-3 flex items-center justify-between text-2xs font-medium text-muted-foreground/80 group-hover:text-primary transition-colors">
                  <span>{config.actionLabel}</span>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="size-3.5 transition-transform duration-200 group-hover:translate-x-1"
                  />
                </CardFooter>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
