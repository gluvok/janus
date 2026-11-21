import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDownRight01Icon,
  ArrowUpRight01Icon,
  CircleMinusIcon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";
import type { AutomaticWeighmentType } from "@/app/weighments/types";

interface WeighmentTypeConfig {
  label: string;
  icon: typeof Clock01Icon;
  className: string;
}

const WEIGHMENT_TYPE_CONFIGS: Record<AutomaticWeighmentType, WeighmentTypeConfig> = {
  pending: {
    label: "Pending",
    icon: Clock01Icon,
    className:
      "gap-1 text-2xs font-normal text-amber-900 border-amber-300/80 bg-amber-600/10 dark:text-amber-200 dark:border-amber-800/50 dark:bg-amber-950/30",
  },
  in: {
    label: "In",
    icon: ArrowDownRight01Icon,
    className:
      "gap-1 text-2xs font-normal text-primary border-primary/30 bg-primary/10 dark:text-primary dark:border-primary/40 dark:bg-primary/15",
  },
  out: {
    label: "Out",
    icon: ArrowUpRight01Icon,
    className:
      "gap-1 text-2xs font-normal text-orange-900 border-orange-300/80 bg-orange-600/10 dark:text-orange-200 dark:border-orange-800/50 dark:bg-orange-950/30",
  },
  unassigned: {
    label: "Unassigned",
    icon: CircleMinusIcon,
    className:
      "gap-1 text-2xs font-normal text-stone-700 border-stone-300/80 bg-stone-500/10 dark:text-stone-300 dark:border-stone-700/80 dark:bg-stone-900/30",
  },
};

export interface WeighmentTypeBadgeProps {
  type: AutomaticWeighmentType;
}

export function WeighmentTypeBadge({ type }: WeighmentTypeBadgeProps) {
  const config = WEIGHMENT_TYPE_CONFIGS[type];

  return (
    <Badge variant="outline" className={config.className}>
      <HugeiconsIcon icon={config.icon} className="size-3" />
      {config.label}
    </Badge>
  );
}
