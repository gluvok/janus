"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, UserAdd01Icon, UserEdit01Icon } from "@hugeicons/core-free-icons";
import {
  CredentialsFields,
  CustomerPortalSwitch,
  FullNameField,
  UserDialogShell,
} from "./user-dialog-primitives";
import { getCustomerFormSchema, type CustomerFormInput, type User } from "./types";

interface CustomerUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  onSuccess: () => void;
}

function getCustomerInitialValues(user?: User | null): CustomerFormInput {
  return {
    id: user?.id,
    portalAccessEnabled: Boolean(user?.username),
    name: user?.name ?? "",
    username: user?.username ?? "",
    password: "",
  };
}

export function CustomerUserDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: CustomerUserDialogProps) {
  const isEdit = Boolean(user);
  const [formError, setFormError] = useState<string | null>(null);

  const formSchema = useMemo(
    () => getCustomerFormSchema({ isEdit, hasExistingCredentials: Boolean(user?.username) }),
    [isEdit, user?.username],
  );

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isDirty, isValid, isSubmitting, errors },
  } = useForm<CustomerFormInput>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: getCustomerInitialValues(user),
  });

  const name = watch("name");
  const portalAccessEnabled = watch("portalAccessEnabled");
  const username = watch("username");
  const password = watch("password");

  useEffect(() => {
    if (open) {
      setFormError(null);
      reset(getCustomerInitialValues(user));
    }
  }, [open, user, reset]);

  const isPasswordRequired = portalAccessEnabled && (!isEdit || !user?.username);

  const onSubmit = async (values: CustomerFormInput) => {
    setFormError(null);

    const payload = {
      ...(isEdit && user ? { id: user.id } : {}),
      name: values.name.trim(),
      role: "customer" as const,
      username: values.portalAccessEnabled ? (values.username?.toLowerCase().trim() ?? "") : "",
      password: values.portalAccessEnabled ? (values.password?.trim() ?? "") : "",
    };

    try {
      if (isEdit) {
        await axios.patch("/api/users", payload);
      } else {
        await axios.post("/api/users", payload);
      }

      toast.add({
        type: "success",
        title: isEdit ? "Customer updated" : "Customer created",
        description: payload.username
          ? `Account "${payload.username}" has been ${isEdit ? "successfully updated" : "created successfully"}.`
          : `Customer "${payload.name}" has been ${isEdit ? "successfully updated" : "created successfully"}.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "An unexpected error occurred.");
      setFormError(msg);
      toast.add({
        type: "error",
        title: isEdit ? "Failed to update customer" : "Failed to create customer",
        description: msg,
      });
    }
  };

  return (
    <UserDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Customer" : "Add New Customer"}
      description={
        isEdit
          ? "Modify portal credentials or update account information."
          : "Register a new agricultural supplier or customer profile."
      }
      headerIcon={isEdit ? UserEdit01Icon : UserAdd01Icon}
      formError={formError}
      isDirty={isDirty}
      isValid={isValid}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={isEdit ? "Save Changes" : "Create Customer"}
    >
      {/* Row 1: Full Name (full-width) */}
      <FullNameField
        value={name}
        onChange={(val) => setValue("name", val, { shouldValidate: true, shouldDirty: true })}
        placeholder="e.g. Ramesh Kumar"
        description="Customer or enterprise name on delivery tickets."
        error={errors.name?.message}
      />

      {/* Row 2: Customer Portal Access Toggle */}
      <CustomerPortalSwitch
        checked={portalAccessEnabled}
        onCheckedChange={(checked) => {
          setValue("portalAccessEnabled", checked, { shouldValidate: true, shouldDirty: true });
          if (!checked) {
            setValue("username", "", { shouldValidate: true, shouldDirty: true });
            setValue("password", "", { shouldValidate: true, shouldDirty: true });
          }
        }}
      />

      {/* Warning banner when disabling portal access on an existing active portal user */}
      {isEdit && Boolean(user?.username) && !portalAccessEnabled && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
          <HugeiconsIcon icon={AlertCircleIcon} className="mt-0.5 size-4 shrink-0" />
          <span>
            Disabling portal access will revoke this customer&apos;s login credentials and prevent
            them from viewing weighments online.
          </span>
        </div>
      )}

      {/* Row 3: Credentials (only rendered when portal access is enabled) */}
      {portalAccessEnabled && (
        <CredentialsFields
          username={username ?? ""}
          setUsername={(val) =>
            setValue("username", val, { shouldValidate: true, shouldDirty: true })
          }
          usernameError={errors.username?.message}
          password={password ?? ""}
          setPassword={(val) =>
            setValue("password", val, { shouldValidate: true, shouldDirty: true })
          }
          passwordError={errors.password?.message}
          isPasswordRequired={isPasswordRequired}
          usernamePlaceholder="e.g. kisan_ramesh"
          usernameDescription="Lowercase portal login handle."
        />
      )}
    </UserDialogShell>
  );
}
