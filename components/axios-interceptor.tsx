"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "@/components/ui/toast";

export function AxiosInterceptor() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

          router.replace(`/login${nextParam}`);
          router.refresh();
        }
        return Promise.reject(error);
      },
    );

    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, [router]);

  return null;
}
