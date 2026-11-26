import type { UserRole } from "@/app/users/types";
import { cn } from "@/lib/utils";

const RECEIPT_ROLE_CONFIG: Record<UserRole, { label: string; className: string }> = {
  admin: {
    label: "Admin",
    className: "bg-[#745063]/10 text-[#745063] border-[#745063]/25",
  },
  manager: {
    label: "Manager",
    className: "bg-[#8c5e1a]/10 text-[#8c5e1a] border-[#8c5e1a]/25",
  },
  operator: {
    label: "Operator",
    className: "bg-[#4a6741]/10 text-[#4a6741] border-[#4a6741]/25",
  },
  base: {
    label: "Base",
    className: "bg-[#efede5] text-[#5f6558] border-[#dfddd2]",
  },
};

export function ReceiptRolePill({ role, className }: { role: UserRole; className?: string }) {
  const config = RECEIPT_ROLE_CONFIG[role] ?? RECEIPT_ROLE_CONFIG.base;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 font-heading text-3xs font-semibold leading-none shrink-0",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
