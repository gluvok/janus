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
    className: "gap-1 text-2xs font-normal text-warning border-warning/25 bg-warning/10",
  },
  approved: {
    label: "Approved",
    icon: CheckmarkCircle02Icon,
    className: "gap-1 text-2xs font-normal text-success border-success/25 bg-success/10",
  },
  rejected: {
    label: "Rejected",
    icon: CancelCircleIcon,
    className: "gap-1 text-2xs font-normal text-terracotta border-terracotta/25 bg-terracotta/10",
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
