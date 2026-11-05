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
  Weighments: {
    accentClass: "text-amber-900 bg-amber-600/10 dark:text-amber-200 dark:bg-amber-950/30",
  },
  Centers: {
    accentClass: "text-stone-800 bg-stone-500/10 dark:text-stone-200 dark:bg-stone-900/30",
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

      {/* Core Operational Module Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {mainNavItems.map((section: NavItem) => {
          const config = MODULE_CONFIGS[section.title] ?? {
            accentClass: "text-primary bg-primary/10",
          };

          return (
            <Link key={section.title} href={section.url} className="group outline-none">
              <Card className="h-full border border-border/70 bg-card/60 transition-all duration-200 hover:border-primary/40 hover:bg-card hover:shadow-xs cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={cn(
                        "flex size-10 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105",
                        config.accentClass,
                      )}
                    >
                      <HugeiconsIcon icon={section.icon} className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
                        {section.title}
                      </CardTitle>
                      {section.description && (
                        <CardDescription className="text-2xs text-muted-foreground line-clamp-1">
                          {section.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="text-muted-foreground/60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary">
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
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
