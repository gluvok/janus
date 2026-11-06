"use client";

import { useEffect, useRef } from "react";
import { useUserStore } from "@/stores/use-user-store";
import { useFactoryStore } from "@/stores/use-factory-store";
import type { User } from "@/app/users/types";
import type { Factory } from "@/app/settings/types";

export interface UserStoreInitializerProps {
  initialUser: User | null;
  initialFactory: Factory | null;
}

export function UserStoreInitializer({ initialUser, initialFactory }: UserStoreInitializerProps) {
  const initialized = useRef(false);

  if (!initialized.current) {
    useUserStore.setState({ user: initialUser });
    useFactoryStore.setState({ factory: initialFactory });
    initialized.current = true;
  }

  useEffect(() => {
    useUserStore.setState({ user: initialUser });
    useFactoryStore.setState({ factory: initialFactory });
  }, [initialUser, initialFactory]);

  return null;
}
