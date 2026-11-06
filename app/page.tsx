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
import { mainNavItems, type NavItem } from "@/lib/navigation";
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
  Centers: {
    category: "Facilities",
    accentClass:
      "text-stone-800 bg-stone-500/10 border-stone-300/50 dark:text-stone-200 dark:bg-stone-900/30 dark:border-stone-700/50",
    actionLabel: "Manage centers",
  },
  Users: {
    category: "Access",
    accentClass:
      "text-zinc-900 bg-zinc-600/10 border-zinc-300/50 dark:text-zinc-100 dark:bg-zinc-800/40 dark:border-zinc-700/50",
    actionLabel: "Manage users",
  },
  Tickets: {
    category: "Support",
    accentClass: "text-primary bg-primary/10 border-primary/30",
    actionLabel: "View tickets",
  },
};

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

      {/* Core Operational Module Cards (4-Column Layout) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {mainNavItems.map((section: NavItem) => {
          const config = MODULE_CONFIGS[section.title];

          return (
            <Link key={section.title} href={section.url} className="group outline-none flex">
              <Card className="flex flex-col justify-between w-full border border-border/80 bg-card/70 transition-all duration-200 hover:border-primary/40 hover:bg-card hover:shadow-xs cursor-pointer rounded-xl overflow-hidden">
                <CardHeader className="p-4 pb-2 space-y-0 flex flex-row items-center justify-between">
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
                <CardContent className="p-4 pt-2 pb-4 space-y-1.5 flex-1">
                  <CardTitle className="text-sm font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
                    {section.title}
                  </CardTitle>
                  {section.description && (
                    <CardDescription className="text-2xs text-muted-foreground leading-relaxed line-clamp-2">
                      {section.description}
                    </CardDescription>
                  )}
                </CardContent>
                <CardFooter className="p-4 pt-2 border-t border-border/50 flex items-center justify-between text-2xs font-medium text-muted-foreground/80 group-hover:text-primary transition-colors">
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
