"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useModeStore } from "@/stores/use-mode-store";

export default function WeighmentsPage() {
  const router = useRouter();
  const mode = useModeStore((s) => s.modes.weighments);

  useEffect(() => {
    router.replace(`/weighments/${mode}`);
  }, [router, mode]);

  return null;
}
