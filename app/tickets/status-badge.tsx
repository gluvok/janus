import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { CancelCircleIcon, CheckmarkCircle02Icon, Clock01Icon } from "@hugeicons/core-free-icons";
import type { TicketStatus } from "./types";

interface TicketStatusBadgeProps {
  status: TicketStatus;
}

export function TicketStatusBadge({ status }: TicketStatusBadgeProps) {
  switch (status) {
    case "pending":
      return (
        <Badge
          variant="outline"
          className="gap-1 text-2xs font-normal text-amber-900 border-amber-300/80 bg-amber-600/10 dark:text-amber-200 dark:border-amber-800/50 dark:bg-amber-950/30"
        >
          <HugeiconsIcon icon={Clock01Icon} className="size-3" />
          Pending
        </Badge>
      );
    case "approved":
      return (
        <Badge
          variant="outline"
          className="gap-1 text-2xs font-normal text-emerald-900 border-emerald-300/80 bg-emerald-600/10 dark:text-emerald-200 dark:border-emerald-800/50 dark:bg-emerald-950/30"
        >
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3" />
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge
          variant="outline"
          className="gap-1 text-2xs font-normal text-orange-900 border-orange-300/80 bg-orange-600/10 dark:text-orange-200 dark:border-orange-800/50 dark:bg-orange-950/30"
        >
          <HugeiconsIcon icon={CancelCircleIcon} className="size-3" />
          Rejected
        </Badge>
      );
  }
}
