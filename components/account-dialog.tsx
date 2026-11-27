"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { usePathname, useRouter } from "next/navigation";
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
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import {
  DialogActionFooter,
  DialogIconBadge,
  FormErrorBanner,
  FormRequiredNotice,
} from "@/components/form-primitives";
import { FullNameField, UsernameField, PasswordField } from "@/app/users/dialog-primitives";
import { RoleBadge } from "@/components/role-badge";
import { toast } from "@/components/ui/toast";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar01Icon, Clock01Icon, Key01Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { nameSchema, usernameSchema, passwordSchema, type User } from "@/app/users/types";
import { type Factory } from "@/app/settings/types";
import { useUserStore } from "@/stores/use-user-store";
import { useFactoryStore } from "@/stores/use-factory-store";

const accountFormSchema = z
  .object({
    name: nameSchema,
    username: usernameSchema,
    password: passwordSchema.optional().or(z.literal("")),
    current_password: z.string().optional(),
  })
  .refine((v) => !v.password || Boolean(v.current_password), {
    path: ["current_password"],
    error: "Current password is required to set a new one",
  });

type AccountFormInput = z.infer<typeof accountFormSchema>;

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onUserUpdated: (user: User) => void;
}

function getInitialAccountValues(user: User): AccountFormInput {
  return {
    name: user.name,
    username: user.username,
    password: "",
    current_password: "",
  };
}

export function AccountDialog({ open, onOpenChange, user, onUserUpdated }: AccountDialogProps) {
  const [currentUser, setCurrentUser] = useState<User>(user);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isDirty, isSubmitting, errors },
  } = useForm<AccountFormInput>({
    resolver: zodResolver(accountFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: getInitialAccountValues(currentUser),
  });

  const name = watch("name");
  const username = watch("username");
  const password = watch("password");
  const currentPassword = watch("current_password");

  useEffect(() => {
    if (open) {
      setFormError(null);
      setIsFetchingProfile(true);
      axios
        .get<{ data: { user: User; factory: Factory } }>("/api/users/me")
        .then((res) => {
          const freshUser = res.data.data.user;
          const freshFactory = res.data.data.factory;
          setCurrentUser(freshUser);
          reset(getInitialAccountValues(freshUser));
          onUserUpdated(freshUser);
          useUserStore.getState().setUser(freshUser);
          useFactoryStore.getState().setFactory(freshFactory);
        })
        .catch((err: unknown) => {
          setFormError(getErrorMessage(err, "Failed to load latest profile."));
        })
        .finally(() => {
          setIsFetchingProfile(false);
        });
    }
  }, [open, onUserUpdated, reset]);

  const onSubmit = async (values: AccountFormInput) => {
    setFormError(null);

    const payload: {
      name: string;
      username: string;
      password?: string;
      current_password?: string;
    } = {
      // zodResolver already ran nameSchema/usernameSchema (trim, lowercase).
      name: values.name,
      username: values.username,
    };

    // Passwords are sent exactly as typed: login compares them untrimmed.
    if (values.password) {
      payload.password = values.password;
      payload.current_password = values.current_password;
    }

    try {
      const res = await axios.patch<{ data: User; reauth: boolean }>("/api/users/me", payload);
      const updatedUser = res.data.data;

      if (res.data.reauth) {
        // Server revoked every session (incl. this one) and cleared the cookie.
        toast.add({
          type: "success",
          title: "Credentials updated",
          description: "Please sign in again with your new credentials.",
        });
        useUserStore.getState().setUser(null);
        useFactoryStore.getState().setFactory(null);
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      setCurrentUser(updatedUser);
      onUserUpdated(updatedUser);
      useUserStore.getState().setUser(updatedUser);

      toast.add({
        type: "success",
        title: "Profile updated",
        description: "Your profile details have been saved successfully.",
      });

      onOpenChange(false);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to update profile.");
      setFormError(msg);
      toast.add({
        type: "error",
        title: "Update failed",
        description: msg,
      });
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
          {isFetchingProfile && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-sm">
              <Spinner className="size-6 text-primary" />
            </div>
          )}

          <div
            className={cn(
              "flex flex-col gap-4 pt-1 pb-0 transition-opacity",
              isFetchingProfile ? "pointer-events-none opacity-40 select-none" : "opacity-100",
            )}
          >
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
              <div className="flex items-center justify-between min-h-5">
                <span className="text-muted-foreground">Assigned Role</span>
                <RoleBadge role={currentUser.role} />
              </div>
              <div className="flex items-center justify-between min-h-5">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <HugeiconsIcon icon={Calendar01Icon} className="size-3" />
                  <span>Member Since</span>
                </span>
                <span className="text-foreground">{formatDateTime(currentUser.created_at)}</span>
              </div>
              <div className="flex items-center justify-between min-h-5">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <HugeiconsIcon icon={Clock01Icon} className="size-3" />
                  <span>Last Updated</span>
                </span>
                <span className="text-foreground">{formatDateTime(currentUser.updated_at)}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormRequiredNotice />
              <FormErrorBanner error={formError} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FullNameField
                  value={name}
                  onChange={(val) =>
                    setValue("name", val, { shouldValidate: true, shouldDirty: true })
                  }
                  placeholder="e.g. Alex Morgan"
                  description="Your display name."
                  error={errors.name?.message}
                />

                <UsernameField
                  value={username}
                  onChange={(val) =>
                    setValue("username", val, { shouldValidate: true, shouldDirty: true })
                  }
                  placeholder="e.g. admin1"
                  description="Lowercase handle."
                  error={errors.username?.message}
                  isRequired={true}
                />
              </div>

              <PasswordField
                value={password || ""}
                onChange={(val) =>
                  setValue("password", val, { shouldValidate: true, shouldDirty: true })
                }
                error={errors.password?.message}
                isRequired={false}
                placeholder="Leave blank to keep current"
                description="Account password."
              />

              {password && (
                <Field data-invalid={Boolean(errors.current_password)}>
                  <FieldLabel htmlFor="current-password">
                    <HugeiconsIcon icon={Key01Icon} className="size-3.5 text-muted-foreground" />
                    <span>Current Password</span>
                    <span className="text-destructive font-semibold" aria-hidden="true">
                      *
                    </span>
                  </FieldLabel>
                  <PasswordInput
                    id="current-password"
                    value={currentPassword || ""}
                    onChange={(e) =>
                      setValue("current_password", e.target.value, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                    placeholder="Enter your current password"
                    aria-invalid={Boolean(errors.current_password)}
                    className="h-8 text-xs"
                    autoComplete="current-password"
                  />
                  {errors.current_password && (
                    <FieldError errors={[{ message: errors.current_password.message }]} />
                  )}
                  <FieldDescription>Required to change your password.</FieldDescription>
                </Field>
              )}

              <DialogActionFooter
                isDirty={isDirty}
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
