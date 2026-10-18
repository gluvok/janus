import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { Briefcase01Icon, CrownIcon, HeadsetIcon, UserIcon } from "@hugeicons/core-free-icons";
import type { UserRole } from "@/app/users/types";

interface RoleBadgeProps {
  role: UserRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  switch (role) {
    case "admin":
      return (
        <Badge
          variant="outline"
          className="gap-1 text-2xs font-normal text-zinc-900 border-zinc-300 bg-zinc-600/10 dark:text-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/40"
        >
          <HugeiconsIcon icon={CrownIcon} className="size-3" />
          Admin
        </Badge>
      );
    case "manager":
      return (
        <Badge
          variant="outline"
          className="gap-1 text-2xs font-normal text-amber-900 border-amber-300/80 bg-amber-600/10 dark:text-amber-200 dark:border-amber-800/50 dark:bg-amber-950/30"
        >
          <HugeiconsIcon icon={Briefcase01Icon} className="size-3" />
          Manager
        </Badge>
      );
    case "operator":
      return (
        <Badge
          variant="outline"
          className="gap-1 text-2xs font-normal text-primary border-primary/30 bg-primary/10 dark:text-primary dark:border-primary/40 dark:bg-primary/15"
        >
          <HugeiconsIcon icon={HeadsetIcon} className="size-3" />
          Operator
        </Badge>
      );
    case "base":
      return (
        <Badge
          variant="outline"
          className="gap-1 text-2xs font-normal text-stone-700 border-stone-300/80 bg-stone-500/10 dark:text-stone-300 dark:border-stone-700/80 dark:bg-stone-900/30"
        >
          <HugeiconsIcon icon={UserIcon} className="size-3" />
          Base
        </Badge>
      );
  }
}
