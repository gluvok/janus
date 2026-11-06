"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { cn, getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { FormErrorBanner } from "@/components/form-primitives";
import { usernameSchema, passwordSchema } from "@/app/users/types";

const loginFormSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
  })
  .strict();

type LoginFormValues = z.infer<typeof loginFormSchema>;

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/";
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    mode: "onChange",
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      setServerError(null);
      await axios.post("/api/auth/login", {
        username: values.username.toLowerCase().trim(),
        password: values.password,
      });

      router.replace(nextUrl);
      router.refresh();
    } catch (err: unknown) {
      setServerError(getErrorMessage(err, "Invalid username or password."));
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg font-bold tracking-tight">Login to your account</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Enter your system username and password to access the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormErrorBanner error={serverError} />

            <Field data-invalid={Boolean(errors.username)}>
              <FieldLabel htmlFor="login-username">
                <span>Username</span>
                <span className="text-destructive font-semibold" aria-hidden="true">
                  *
                </span>
              </FieldLabel>
              <Input
                id="login-username"
                placeholder="e.g. alex_operator"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                {...register("username")}
                aria-invalid={Boolean(errors.username)}
                className="h-8 text-xs font-mono"
              />
              {errors.username?.message && (
                <FieldError errors={[{ message: errors.username.message }]} />
              )}
            </Field>

            <Field data-invalid={Boolean(errors.password)}>
              <FieldLabel htmlFor="login-password">
                <span>Password</span>
                <span className="text-destructive font-semibold" aria-hidden="true">
                  *
                </span>
              </FieldLabel>
              <PasswordInput
                id="login-password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...register("password")}
                aria-invalid={Boolean(errors.password)}
                className="h-8 text-xs"
              />
              {errors.password?.message && (
                <FieldError errors={[{ message: errors.password.message }]} />
              )}
            </Field>

            <Button
              type="submit"
              disabled={isSubmitting || !isValid}
              className="w-full h-8 text-xs font-medium cursor-pointer"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-1.5">
                  <Spinner className="size-3.5" />
                  <span>Logging in...</span>
                </div>
              ) : (
                "Login"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
