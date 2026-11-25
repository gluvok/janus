"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useModeStore } from "@/stores/use-mode-store";

export default function TicketsPage() {
  const router = useRouter();
  const mode = useModeStore((s) => s.modes.tickets);

  useEffect(() => {
    router.replace(`/tickets/${mode}`);
  }, [mode, router]);

  return null;
}
