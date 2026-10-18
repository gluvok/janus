"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTableHydrated } from "@/stores/use-data-table-store";
import { Spinner } from "@/components/ui/spinner";

export function BootingScreen() {
  const hasHydrated = useTableHydrated();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (mounted && hasHydrated) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background select-none"
      aria-live="polite"
      aria-busy={true}
    >
      <div className="flex flex-col items-center gap-3">
        <Image
          src="/logo.png"
          alt="Mesto Logo"
          width={44}
          height={44}
          priority
          className="size-11 object-contain drop-shadow-xs"
        />
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-heading font-semibold text-sm tracking-tight text-foreground">
            Mesto
          </span>
          <span className="text-2xs text-muted-foreground">Automations Platform</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 text-xs font-medium text-muted-foreground">
        <Spinner className="size-3.5 text-primary" />
        <span className="animate-pulse">Booting up...</span>
      </div>
    </div>
  );
}
