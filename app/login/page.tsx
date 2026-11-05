import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/components/login-form";
import { Spinner } from "@/components/ui/spinner";

export const metadata: Metadata = {
  title: "Login | Mesto",
  description: "Login to Mesto Automations Platform",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center p-6 md:p-10 bg-background">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 self-center text-center">
          <Image
            src="/logo.png"
            alt="Mesto Logo"
            width={48}
            height={48}
            priority
            className="size-12 object-contain rounded-lg drop-shadow-xs"
          />
          <div className="flex flex-col">
            <span className="font-heading font-bold text-base tracking-tight text-foreground">
              Mesto
            </span>
            <span className="text-2xs text-muted-foreground">Automations Platform</span>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="flex justify-center p-8">
              <Spinner className="size-6 text-primary" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
