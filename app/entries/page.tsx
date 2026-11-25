"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useModeStore } from "@/stores/use-mode-store";

export default function EntriesPage() {
  const router = useRouter();
  const mode = useModeStore((s) => s.modes.entries);

  useEffect(() => {
    router.replace(`/entries/${mode}`);
  }, [mode, router]);

  return null;
}
