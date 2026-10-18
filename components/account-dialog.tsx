"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import {
  DialogActionFooter,
  DialogIconBadge,
  FormErrorBanner,
  FormRequiredNotice,
} from "@/components/form-primitives";
import { RoleBadge } from "@/components/role-badge";
import { toast } from "@/components/ui/toast";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar01Icon,
  Clock01Icon,
  Key01Icon,
  TextFontIcon,
  UserCircleIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { nameSchema, usernameSchema, passwordSchema, type User } from "@/app/users/types";

const accountFormSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  password: passwordSchema.optional().or(z.literal("")),
});

type AccountFormInput = z.infer<typeof accountFormSchema>;

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onUserUpdated: (user: User) => void;
}

function getInitialAccountValues(user: User | null): AccountFormInput {
  return {
    name: user?.name ?? "",
    username: user?.username ?? "",
    password: "",
  };
}

export function AccountDialog({ open, onOpenChange, user, onUserUpdated }: AccountDialogProps) {
  const [accountUser, setAccountUser] = useState<User | null>(user);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const displayUser = accountUser ?? user;

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isDirty, isValid, isSubmitting, errors },
  } = useForm<AccountFormInput>({
    resolver: zodResolver(accountFormSchema),
    mode: "onChange",
    defaultValues: getInitialAccountValues(user),
  });

  const name = watch("name");
  const username = watch("username");
  const password = watch("password");

  const fetchMe = useCallback(async () => {
    try {
      setLoading(true);
      setFormError(null);
      const response = await axios.get<{ data: User }>("/api/users/me");
      const freshUser = response.data.data;
      setAccountUser(freshUser);
      reset(getInitialAccountValues(freshUser));
      onUserUpdated(freshUser);
    } catch (err: unknown) {
      setFormError(getErrorMessage(err, "Failed to load account profile."));
    } finally {
      setLoading(false);
    }
  }, [reset, onUserUpdated]);

  useEffect(() => {
    if (open) {
      fetchMe();
    }
  }, [open, fetchMe]);

  const onSubmit = async (values: AccountFormInput) => {
    try {
      setFormError(null);
      const payload = {
        name: values.name.trim(),
        username: values.username.trim().toLowerCase(),
        ...(values.password && values.password.trim() ? { password: values.password.trim() } : {}),
      };

      const response = await axios.patch<{ data: User; message: string }>("/api/users/me", payload);

      toast.add({
        type: "success",
        title: "Account Updated",
        description: response.data.message || "Your profile has been saved successfully.",
      });

      setAccountUser(response.data.data);
      onUserUpdated(response.data.data);
      onOpenChange(false);
    } catch (err: unknown) {
      setFormError(getErrorMessage(err, "Failed to update account profile."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md pb-3">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogIconBadge icon={UserCircleIcon} />
            <DialogTitle>Account Settings</DialogTitle>
          </div>
          <DialogDescription>Personal profile and account credentials.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-sm">
              <Spinner className="size-6 text-primary" />
            </div>
          )}

          <div
            className={cn(
              "flex flex-col gap-4 pt-1 pb-0 transition-opacity",
              loading ? "pointer-events-none opacity-40 select-none" : "opacity-100",
            )}
          >
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Assigned Role</span>
                {displayUser ? (
                  <RoleBadge role={displayUser.role} />
                ) : (
                  <span className="text-muted-foreground font-mono">—</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <HugeiconsIcon icon={Calendar01Icon} className="size-3" />
                  <span>Member Since</span>
                </span>
                <span className="text-foreground">
                  {displayUser ? formatDateTime(displayUser.created_at) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <HugeiconsIcon icon={Clock01Icon} className="size-3" />
                  <span>Last Updated</span>
                </span>
                <span className="text-foreground">
                  {displayUser ? formatDateTime(displayUser.updated_at) : "—"}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormRequiredNotice />
              <FormErrorBanner error={formError} />

              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="account-name">
                  <HugeiconsIcon icon={UserIcon} className="size-3.5 text-muted-foreground" />
                  <span>Full Name</span>
                  <span className="text-destructive font-semibold" aria-hidden="true">
                    *
                  </span>
                </FieldLabel>
                <Input
                  id="account-name"
                  value={name}
                  onChange={(e) =>
                    setValue("name", e.target.value, { shouldValidate: true, shouldDirty: true })
                  }
                  placeholder="e.g. Alex Morgan"
                  aria-invalid={Boolean(errors.name)}
                  className="h-8 text-xs"
                />
                {errors.name && <FieldError errors={[{ message: errors.name.message }]} />}
                <FieldDescription>Your legal or administrative display name.</FieldDescription>
              </Field>

              <Field data-invalid={Boolean(errors.username)}>
                <FieldLabel htmlFor="account-username">
                  <HugeiconsIcon icon={TextFontIcon} className="size-3.5 text-muted-foreground" />
                  <span>Username</span>
                  <span className="text-destructive font-semibold" aria-hidden="true">
                    *
                  </span>
                </FieldLabel>
                <Input
                  id="account-username"
                  value={username}
                  onChange={(e) =>
                    setValue("username", e.target.value.toLowerCase(), {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="e.g. admin1"
                  aria-invalid={Boolean(errors.username)}
                  className="h-8 text-xs font-mono"
                  autoComplete="off"
                />
                {errors.username && <FieldError errors={[{ message: errors.username.message }]} />}
                <FieldDescription>Unique lowercase system login handle.</FieldDescription>
              </Field>

              <Field data-invalid={Boolean(errors.password)}>
                <FieldLabel htmlFor="account-password">
                  <HugeiconsIcon icon={Key01Icon} className="size-3.5 text-muted-foreground" />
                  <span>New Password (Optional)</span>
                </FieldLabel>
                <PasswordInput
                  id="account-password"
                  value={password || ""}
                  onChange={(e) =>
                    setValue("password", e.target.value, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Leave blank to keep current password"
                  aria-invalid={Boolean(errors.password)}
                  className="h-8 text-xs"
                  autoComplete="new-password"
                />
                {errors.password && <FieldError errors={[{ message: errors.password.message }]} />}
                <FieldDescription>Leave empty to keep your existing password.</FieldDescription>
              </Field>

              <DialogActionFooter
                isDirty={isDirty}
                isValid={isValid}
                isSubmitting={isSubmitting}
                onCancel={() => onOpenChange(false)}
                submitLabel="Save Changes"
              />
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
