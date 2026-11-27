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
    className: "gap-1 text-2xs font-normal text-foreground border-border bg-secondary",
  },
  manager: {
    label: "Manager",
    icon: Briefcase01Icon,
    className: "gap-1 text-2xs font-normal text-warning border-warning/25 bg-warning/10",
  },
  operator: {
    label: "Operator",
    icon: HeadsetIcon,
    className: "gap-1 text-2xs font-normal text-primary border-primary/25 bg-primary/10",
  },
  base: {
    label: "Base",
    icon: UserIcon,
    className: "gap-1 text-2xs font-normal text-muted-foreground border-border bg-muted",
  },
};

export interface RoleBadgeProps {
  role: UserRole | (string & {});
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = (ROLE_CONFIGS as Record<string, RoleConfig>)[role] ?? {
    label: role ? `${role.charAt(0).toUpperCase()}${role.slice(1)}` : "Unknown",
    icon: UserIcon,
    className: "gap-1 text-2xs font-normal text-muted-foreground border-border bg-muted",
  };

  return (
    <Badge variant="outline" className={config.className}>
      <HugeiconsIcon icon={config.icon} className="size-3" />
      {config.label}
    </Badge>
  );
}
