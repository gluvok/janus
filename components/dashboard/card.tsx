/**
 * @file components/dashboard/card.tsx
 * @description Dashboard card component used on the main home screen to navigate to different project tables.
 */

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { type ProjectTheme } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  name: string;
  href: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  theme?: ProjectTheme;
}

/**
 * DashboardCard Component
 * Displays a clickable grid card with an icon badge, name, description, and static color transitions (no scale/translate).
 */
export function DashboardCard({ name, href, desc, icon: Icon, color, theme }: DashboardCardProps) {
  const cardId = `dashboard-card-${name.toLowerCase().replace(/\s+/g, "-")}`;

  const iconColor = theme?.iconColor || color || "text-foreground";
  const badgeBg = theme?.badgeBg || "bg-muted/50";
  const badgeBorder = theme?.badgeBorder || "border-border/40";
  const cardHoverBorder = theme?.cardHoverBorder || "group-hover:border-muted-foreground/40";
  const cardHoverBg = theme?.cardHoverBg || "group-hover:bg-accent/40";
  const hoverAccent = theme?.hoverAccent || "group-hover:text-primary";

  return (
    <Link
      href={href}
      id={cardId}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      <Card
        className={cn(
          "h-full border-0 bg-background transition-shadow duration-200 cursor-pointer py-1 group-active:neu-inset",
          cardHoverBorder,
          cardHoverBg,
        )}
      >
        <CardHeader className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div
              className={cn(
                "p-2 rounded-xl clay transition-colors duration-200",
                badgeBg,
                badgeBorder,
                iconColor,
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <ArrowRight
              className={cn(
                "h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                hoverAccent,
              )}
            />
          </div>
          <CardTitle
            className={cn(
              "font-bold text-md text-card-foreground transition-colors duration-200 leading-none",
              hoverAccent,
            )}
          >
            {name}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">
            {desc}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
