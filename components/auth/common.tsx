"use client";

/**
 * @file components/auth/common.tsx
 * @description Shared layout and input components for authentication pages.
 */

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { UseFormRegisterReturn, FieldError as HookFieldError } from "react-hook-form";
import { LogoVertical } from "@/components/logo";
import Link from "next/link";

interface AuthCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * AuthCard Component
 * Renders a standard Card structure specialized for authentication forms,
 * including a title, subtitle, main form content, and action/navigation footers.
 */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="flex flex-col gap-6 w-full">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {children}
          {footer}
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <Link href="#">Terms of Service</Link> and{" "}
        <Link href="#">Privacy Policy</Link>.
      </FieldDescription>
    </div>
  );
}

interface AuthInputProps extends React.ComponentProps<typeof Input> {
  label: string;
  error?: HookFieldError;
  registration: UseFormRegisterReturn;
  labelRight?: React.ReactNode;
}

/**
 * AuthInput Component
 * Wrapper around standard form inputs, attaching labels, inline errors,
 * react-hook-form integration, and secondary actions (like "Forgot password?" links).
 */
export function AuthInput({
  label,
  error,
  registration,
  id,
  labelRight,
  ...props
}: AuthInputProps) {
  return (
    <Field {...{ id }}>
      <div className="flex items-center justify-between">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {labelRight}
      </div>
      <Input id={id} {...props} {...registration} />
      {error && <FieldError>{error.message}</FieldError>}
    </Field>
  );
}

interface AuthPageLayoutProps {
  children: React.ReactNode;
}

/**
 * AuthPageLayout Component
 * Master container layout for all auth routes (login, signup, forgot password, etc.).
 * Centers content vertically and horizontally, and displays the platform logo.
 */
export function AuthPageLayout({ children }: AuthPageLayoutProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="#" className="flex items-center justify-center self-center font-medium">
          <LogoVertical size={100} />
        </Link>
        {children}
      </div>
    </div>
  );
}
