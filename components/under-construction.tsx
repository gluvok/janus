import type * as React from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ConstructionIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface UnderConstructionProps {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"];
}

export function UnderConstruction({ title, description, icon }: UnderConstructionProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-96 p-6 text-center">
      <div className="relative mb-4 flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <HugeiconsIcon icon={icon} className="size-8" />
        <span className="absolute -bottom-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <HugeiconsIcon icon={ConstructionIcon} className="size-3.5" />
        </span>
      </div>

      <Badge
        variant="outline"
        className="mb-2 text-amber-900 border-amber-300/80 bg-amber-600/10 dark:text-amber-200 dark:border-amber-800/50 dark:bg-amber-950/30"
      >
        Under Construction
      </Badge>

      <h1 className="text-xl font-semibold text-foreground tracking-tight sm:text-2xl">{title}</h1>

      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>

      <div className="mt-6">
        <Button render={<Link href="/weighments" />} variant="outline" size="sm">
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4 mr-2" />
          Back to Weighments
        </Button>
      </div>
    </div>
  );
}
