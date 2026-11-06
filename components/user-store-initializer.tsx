"use client";

import { useEffect, useRef } from "react";
import { useUserStore } from "@/stores/use-user-store";
import type { User } from "@/app/users/types";

export interface UserStoreInitializerProps {
  initialUser: User | null;
}

export function UserStoreInitializer({ initialUser }: UserStoreInitializerProps) {
  const initialized = useRef(false);

  if (!initialized.current) {
    useUserStore.setState({ user: initialUser });
    initialized.current = true;
  }

  useEffect(() => {
    useUserStore.setState({ user: initialUser });
  }, [initialUser]);

  return null;
}
