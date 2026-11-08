"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { toast } from "@/components/ui/toast";
import { usernameSchema, passwordSchema } from "@/app/users/types";

const loginFormSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
  })
  .strict();

type LoginFormValues = z.infer<typeof loginFormSchema>;

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/";
  const [isRedirecting, setIsRedirecting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      setIsRedirecting(true);
      await axios.post("/api/auth/login", {
        username: values.username,
        password: values.password,
      });

      window.location.href = nextUrl;
    } catch (err: unknown) {
      setIsRedirecting(false);
      toast.add({
        type: "error",
        title: "Login failed",
        description: getErrorMessage(err, "Invalid username or password."),
      });
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
              disabled={isSubmitting || isRedirecting}
              className="w-full h-8 text-xs font-medium cursor-pointer"
            >
              {isSubmitting || isRedirecting ? (
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
