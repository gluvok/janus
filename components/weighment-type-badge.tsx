import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDownRight01Icon,
  ArrowUpRight01Icon,
  CircleMinusIcon,
} from "@hugeicons/core-free-icons";
import type { WeighmentType } from "@/app/weighments/types";

interface WeighmentTypeConfig {
  label: string;
  icon: typeof ArrowDownRight01Icon;
  className: string;
}

const WEIGHMENT_TYPE_CONFIGS: Record<WeighmentType, WeighmentTypeConfig> = {
  in: {
    label: "In",
    icon: ArrowDownRight01Icon,
    className: "gap-1 text-2xs font-normal text-primary border-primary/25 bg-primary/10",
  },
  out: {
    label: "Out",
    icon: ArrowUpRight01Icon,
    className: "gap-1 text-2xs font-normal text-terracotta border-terracotta/25 bg-terracotta/10",
  },
  void: {
    label: "Void",
    icon: CircleMinusIcon,
    className: "gap-1 text-2xs font-normal text-muted-foreground border-border bg-muted",
  },
};

export interface WeighmentTypeBadgeProps {
  type: WeighmentType;
}

export function WeighmentTypeBadge({ type }: WeighmentTypeBadgeProps) {
  const config = WEIGHMENT_TYPE_CONFIGS[type] ?? WEIGHMENT_TYPE_CONFIGS.void;

  return (
    <Badge variant="outline" className={config.className}>
      <HugeiconsIcon icon={config.icon} className="size-3" />
      {config.label}
    </Badge>
  );
}
