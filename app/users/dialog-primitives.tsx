"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxSearchInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Briefcase01Icon,
  CrownIcon,
  HeadsetIcon,
  Key01Icon,
  SecurityCheckIcon,
  TextFontIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import {
  DialogActionFooter,
  DialogIconBadge,
  FormErrorBanner,
  FormRequiredNotice,
} from "@/components/form-primitives";
import { type UserRole } from "./types";

export { DialogActionFooter, DialogIconBadge, FormErrorBanner, FormRequiredNotice };

export const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", icon: CrownIcon },
  { value: "manager", label: "Manager", icon: Briefcase01Icon },
  { value: "operator", label: "Operator", icon: HeadsetIcon },
  { value: "base", label: "Base", icon: UserIcon },
];

interface UserDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  headerIcon: typeof UserIcon;
  formError: string | null;
  isDirty: boolean;
  isValid: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  submitLabel: string;
  children: React.ReactNode;
}

export function UserDialogShell({
  open,
  onOpenChange,
  title,
  description,
  headerIcon,
  formError,
  isDirty,
  isValid,
  isSubmitting,
  onSubmit,
  submitLabel,
  children,
}: UserDialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg pb-3">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogIconBadge icon={headerIcon} />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isValid && isDirty && !isSubmitting) {
              onSubmit();
            }
          }}
          className="flex flex-col gap-4 pt-1 pb-0"
        >
          <FormErrorBanner error={formError} />
          <FormRequiredNotice />

          {children}

          <DialogActionFooter
            isDirty={isDirty}
            isSubmitting={isSubmitting}
            onCancel={() => onOpenChange(false)}
            submitLabel={submitLabel}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface FullNameFieldProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  description: string;
  error?: string;
}

export function FullNameField({
  value,
  onChange,
  placeholder,
  description,
  error,
}: FullNameFieldProps) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor="user-name">
        <HugeiconsIcon icon={UserIcon} className="size-3.5 text-muted-foreground" />
        <span>Full Name</span>
        <span className="text-destructive font-semibold" aria-hidden="true">
          *
        </span>
      </FieldLabel>
      <Input
        id="user-name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className="h-8 text-xs"
      />
      {error && <FieldError errors={[{ message: error }]} />}
      <FieldDescription>{description}</FieldDescription>
    </Field>
  );
}

export interface UsernameFieldProps {
  value: string;
  onChange: (val: string) => void;
  error?: string;
  placeholder?: string;
  description?: string;
  isRequired?: boolean;
}

export function UsernameField({
  value,
  onChange,
  error,
  placeholder = "e.g. jdoe",
  description = "Unique user identifier.",
  isRequired = true,
}: UsernameFieldProps) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor="user-username">
        <HugeiconsIcon icon={TextFontIcon} className="size-3.5 text-muted-foreground" />
        <span>Username</span>
        {isRequired && (
          <span className="text-destructive font-semibold" aria-hidden="true">
            *
          </span>
        )}
      </FieldLabel>
      <Input
        id="user-username"
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className="h-8 text-xs font-mono"
        autoComplete="off"
      />
      {error && <FieldError errors={[{ message: error }]} />}
      <FieldDescription>{description}</FieldDescription>
    </Field>
  );
}

export interface PasswordFieldProps {
  value: string;
  onChange: (val: string) => void;
  error?: string;
  isRequired?: boolean;
  placeholder?: string;
  description?: string;
}

export function PasswordField({
  value,
  onChange,
  error,
  isRequired = true,
  placeholder,
  description,
}: PasswordFieldProps) {
  const defaultPlaceholder = isRequired ? "At least 6 characters" : "Leave blank to keep current";
  const defaultDescription = isRequired ? "Minimum 6 characters." : "Account password.";

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor="user-password">
        <HugeiconsIcon icon={Key01Icon} className="size-3.5 text-muted-foreground" />
        {isRequired ? (
          <>
            <span>Password</span>
            <span className="text-destructive font-semibold" aria-hidden="true">
              *
            </span>
          </>
        ) : (
          <span>New Password (Optional)</span>
        )}
      </FieldLabel>
      <PasswordInput
        id="user-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? defaultPlaceholder}
        aria-invalid={Boolean(error)}
        className="h-8 text-xs"
        autoComplete="new-password"
      />
      {error && <FieldError errors={[{ message: error }]} />}
      <FieldDescription>{description ?? defaultDescription}</FieldDescription>
    </Field>
  );
}

interface CredentialsFieldsProps {
  username: string;
  setUsername: (val: string) => void;
  usernameError?: string;
  password: string;
  setPassword: (val: string) => void;
  passwordError?: string;
  isPasswordRequired: boolean;
  usernamePlaceholder: string;
  usernameDescription: string;
}

export function CredentialsFields({
  username,
  setUsername,
  usernameError,
  password,
  setPassword,
  passwordError,
  isPasswordRequired,
  usernamePlaceholder,
  usernameDescription,
}: CredentialsFieldsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <UsernameField
        value={username}
        onChange={setUsername}
        error={usernameError}
        placeholder={usernamePlaceholder}
        description={usernameDescription}
        isRequired={true}
      />
      <PasswordField
        value={password}
        onChange={setPassword}
        error={passwordError}
        isRequired={isPasswordRequired}
      />
    </div>
  );
}

interface SystemRoleSelectProps {
  value: UserRole;
  onChange: (role: UserRole) => void;
  error?: string;
}

export function SystemRoleSelect({ value, onChange, error }: SystemRoleSelectProps) {
  const selectedOpt = ROLE_OPTIONS.find((o) => o.value === value) ?? ROLE_OPTIONS[0];
  const IconComponent = selectedOpt.icon;

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor="user-role">
        <HugeiconsIcon icon={SecurityCheckIcon} className="size-3.5 text-muted-foreground" />
        <span>System Role</span>
        <span className="text-destructive font-semibold" aria-hidden="true">
          *
        </span>
      </FieldLabel>
      <Combobox
        items={ROLE_OPTIONS}
        value={selectedOpt}
        onValueChange={(val) => {
          if (val) onChange(val.value as UserRole);
        }}
        itemToStringLabel={(opt) => (opt ? opt.label : "")}
        itemToStringValue={(opt) => (opt ? opt.value : "")}
        isItemEqualToValue={(a, b) => a?.value === b?.value}
      >
        <ComboboxTrigger
          id="user-role"
          className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-input/20 px-2.5 text-xs font-normal hover:bg-accent/50 dark:bg-input/30 cursor-pointer"
        >
          <span className="flex items-center gap-1.5 truncate">
            <HugeiconsIcon
              icon={IconComponent}
              className="size-3.5 shrink-0 text-muted-foreground"
            />
            <span className="truncate">{selectedOpt.label}</span>
          </span>
        </ComboboxTrigger>
        <ComboboxContent className="w-max min-w-(--anchor-width) max-w-xs sm:max-w-sm">
          <ComboboxSearchInput placeholder="Search role..." />
          <ComboboxEmpty className="py-2 text-center text-xs text-muted-foreground">
            No role found.
          </ComboboxEmpty>
          <ComboboxList>
            {(opt) => (
              <ComboboxItem
                key={opt.value}
                value={opt}
                className="text-xs whitespace-nowrap cursor-pointer pr-6"
              >
                <HugeiconsIcon
                  icon={opt.icon}
                  className="mr-1.5 size-3.5 shrink-0 text-muted-foreground"
                />
                <span>{opt.label}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {error && <FieldError errors={[{ message: error }]} />}
      <FieldDescription>Permission tier for system access.</FieldDescription>
    </Field>
  );
}

export interface UserFormFieldsProps {
  name: string;
  setName: (val: string) => void;
  nameError?: string;
  role: UserRole;
  setRole: (val: UserRole) => void;
  roleError?: string;
  username: string;
  setUsername: (val: string) => void;
  usernameError?: string;
  password?: string;
  setPassword: (val: string) => void;
  passwordError?: string;
  isPasswordRequired: boolean;
}

export function UserFormFields({
  name,
  setName,
  nameError,
  role,
  setRole,
  roleError,
  username,
  setUsername,
  usernameError,
  password,
  setPassword,
  passwordError,
  isPasswordRequired,
}: UserFormFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FullNameField
          value={name}
          onChange={setName}
          placeholder="e.g. Alex Morgan"
          description="Operator name displayed in audit trails."
          error={nameError}
        />
        <SystemRoleSelect value={role} onChange={setRole} error={roleError} />
      </div>

      <CredentialsFields
        username={username}
        setUsername={setUsername}
        usernameError={usernameError}
        password={password ?? ""}
        setPassword={setPassword}
        passwordError={passwordError}
        isPasswordRequired={isPasswordRequired}
        usernamePlaceholder="e.g. alex_operator"
        usernameDescription="Unique lowercase login handle."
      />
    </>
  );
}
