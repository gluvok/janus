import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { Briefcase01Icon, CrownIcon, HeadsetIcon, UserIcon } from "@hugeicons/core-free-icons";
import type { UserRole } from "@/app/users/types";

interface RoleConfig {
  label: string;
  icon: typeof CrownIcon;
  className: string;
}

const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  admin: {
    label: "Admin",
    icon: CrownIcon,
    className:
      "gap-1 text-2xs font-normal text-zinc-900 border-zinc-300 bg-zinc-600/10 dark:text-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/40",
  },
  manager: {
    label: "Manager",
    icon: Briefcase01Icon,
    className:
      "gap-1 text-2xs font-normal text-amber-900 border-amber-300/80 bg-amber-600/10 dark:text-amber-200 dark:border-amber-800/50 dark:bg-amber-950/30",
  },
  operator: {
    label: "Operator",
    icon: HeadsetIcon,
    className:
      "gap-1 text-2xs font-normal text-primary border-primary/30 bg-primary/10 dark:text-primary dark:border-primary/40 dark:bg-primary/15",
  },
  base: {
    label: "Base",
    icon: UserIcon,
    className:
      "gap-1 text-2xs font-normal text-stone-700 border-stone-300/80 bg-stone-500/10 dark:text-stone-300 dark:border-stone-700/80 dark:bg-stone-900/30",
  },
};

export interface RoleBadgeProps {
  role: UserRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = ROLE_CONFIGS[role];

  return (
    <Badge variant="outline" className={config.className}>
      <HugeiconsIcon icon={config.icon} className="size-3" />
      {config.label}
    </Badge>
  );
}
