import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { mainNavItems, type NavItem } from "@/lib/navigation";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

interface ModuleConfig {
  accentClass: string;
}

const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  Centers: {
    accentClass: "text-stone-800 bg-stone-500/10 dark:text-stone-200 dark:bg-stone-900/30",
  },
  Entries: {
    accentClass: "text-orange-900 bg-orange-600/10 dark:text-orange-200 dark:bg-orange-950/30",
  },
  Weighments: {
    accentClass: "text-amber-900 bg-amber-600/10 dark:text-amber-200 dark:bg-amber-950/30",
  },
  Customers: {
    accentClass: "text-emerald-900 bg-emerald-600/10 dark:text-emerald-200 dark:bg-emerald-950/30",
  },
  Users: {
    accentClass: "text-zinc-900 bg-zinc-600/10 dark:text-zinc-100 dark:bg-zinc-800/40",
  },
  Tickets: {
    accentClass: "text-primary bg-primary/10",
  },
};

export default function Home() {
  return (
    <div className="flex flex-1 min-h-0 flex-col gap-6 overflow-y-auto p-1">
      {/* Top Welcome Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight font-heading text-foreground">
          Operational Dashboard
        </h1>
        <p className="text-xs text-muted-foreground">
          Centralized automation and weighment management platform.
        </p>
      </div>

      {/* 6 Module Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mainNavItems.map((section: NavItem) => {
          const config = MODULE_CONFIGS[section.title] ?? {
            accentClass: "text-primary bg-primary/10",
          };

          return (
            <Link
              key={section.title}
              href={section.url}
              className="group rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full border border-border/80 bg-card/70 transition-all duration-200 hover:border-primary/40 hover:bg-card hover:shadow-xs">
                <CardHeader className="flex flex-col justify-between gap-3 p-3.5 h-full">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/40 transition-transform duration-200 group-hover:scale-105",
                        config.accentClass,
                      )}
                    >
                      <HugeiconsIcon icon={section.icon} className="size-4" />
                    </div>

                    <div className="flex flex-col gap-0.5 min-w-0">
                      <CardTitle className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                        {section.title}
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground line-clamp-2">
                        {section.description}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/40 pt-2 text-2xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
                    <span>Manage {section.title.toLowerCase()}</span>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      className="size-3 transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
