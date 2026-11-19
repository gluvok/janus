import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { CancelCircleIcon, CheckmarkCircle02Icon, Clock01Icon } from "@hugeicons/core-free-icons";
import type { TicketStatus } from "./types";

interface TicketStatusConfig {
  label: string;
  icon: typeof Clock01Icon;
  className: string;
}

const STATUS_CONFIGS: Record<TicketStatus, TicketStatusConfig> = {
  pending: {
    label: "Pending",
    icon: Clock01Icon,
    className:
      "gap-1 text-2xs font-normal text-amber-900 border-amber-300/80 bg-amber-600/10 dark:text-amber-200 dark:border-amber-800/50 dark:bg-amber-950/30",
  },
  approved: {
    label: "Approved",
    icon: CheckmarkCircle02Icon,
    className:
      "gap-1 text-2xs font-normal text-emerald-900 border-emerald-300/80 bg-emerald-600/10 dark:text-emerald-200 dark:border-emerald-800/50 dark:bg-emerald-950/30",
  },
  rejected: {
    label: "Rejected",
    icon: CancelCircleIcon,
    className:
      "gap-1 text-2xs font-normal text-orange-900 border-orange-300/80 bg-orange-600/10 dark:text-orange-200 dark:border-orange-800/50 dark:bg-orange-950/30",
  },
};

export interface TicketStatusBadgeProps {
  status: TicketStatus;
}

export function TicketStatusBadge({ status }: TicketStatusBadgeProps) {
  const config = STATUS_CONFIGS[status];

  return (
    <Badge variant="outline" className={config.className}>
      <HugeiconsIcon icon={config.icon} className="size-3" />
      {config.label}
    </Badge>
  );
}
