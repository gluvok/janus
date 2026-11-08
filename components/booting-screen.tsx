"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import axios from "axios";
import { useUserStore } from "@/stores/use-user-store";
import { useFactoryStore } from "@/stores/use-factory-store";
import { useTableHydrated } from "@/stores/use-data-table-store";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import type { User } from "@/app/users/types";
import type { Factory } from "@/app/settings/types";

export interface BootingScreenProps {
  initialUser: User | null;
  initialFactory: Factory | null;
  children: React.ReactNode;
}

export function BootingScreen({ initialUser, initialFactory, children }: BootingScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 1. Initialize User & Factory stores synchronously
  const initialized = useRef(false);
  if (!initialized.current) {
    useUserStore.setState({ user: initialUser, isInitialized: true });
    useFactoryStore.setState({ factory: initialFactory });
    initialized.current = true;
  }

  useEffect(() => {
    useUserStore.setState({ user: initialUser, isInitialized: true });
    useFactoryStore.setState({ factory: initialFactory });
  }, [initialUser, initialFactory]);

  // 2. Network 401 interceptor for automatic session expiration handling
  const currentPathRef = useRef(pathname);
  const currentSearchRef = useRef(searchParams);

  useEffect(() => {
    currentPathRef.current = pathname;
    currentSearchRef.current = searchParams;
  }, [pathname, searchParams]);

  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (
          axios.isAxiosError(error) &&
          error.response?.status === 401 &&
          !currentPathRef.current.startsWith("/login")
        ) {
          toast.add({
            type: "error",
            title: "Session Expired",
            description: "Your session has expired. Please log in again.",
          });

          const currentQuery = currentSearchRef.current.toString();
          const target = currentQuery
            ? `${currentPathRef.current}?${currentQuery}`
            : currentPathRef.current;
          const nextParam = target && target !== "/" ? `?next=${encodeURIComponent(target)}` : "";

          useUserStore.getState().setUser(null);
          useFactoryStore.getState().setFactory(null);
          router.replace(`/login${nextParam}`);
        }
        return Promise.reject(error);
      },
    );

    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, [router]);

  // 3. Hydration check
  const isUserInitialized = useUserStore((state) => state.isInitialized);
  const hasTableHydrated = useTableHydrated();

  if (!isUserInitialized || !hasTableHydrated) {
    return (
      <div
        className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background select-none"
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

  return <>{children}</>;
}
