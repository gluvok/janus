"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/utils";
import { UserAdd01Icon, UserEdit01Icon } from "@hugeicons/core-free-icons";
import {
  CredentialsFields,
  FullNameField,
  SystemRoleSelect,
  UserDialogShell,
} from "./user-dialog-primitives";
import {
  getStaffFormSchema,
  type CreateStaffUserInput,
  type StaffFormInput,
  type StaffRole,
  type UpdateStaffUserInput,
  type User,
} from "./types";

interface StaffUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  onSuccess: () => void;
}

function getStaffInitialValues(user?: User | null): StaffFormInput {
  return {
    id: user?.id,
    name: user?.name ?? "",
    role: (user?.role as StaffRole) || "operator",
    username: user?.username ?? "",
    password: "",
  };
}

export function StaffUserDialog({ open, onOpenChange, user, onSuccess }: StaffUserDialogProps) {
  const isEdit = Boolean(user);
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(() => getStaffFormSchema({ isEdit }), [isEdit]);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isDirty, isValid, isSubmitting, errors },
  } = useForm<StaffFormInput>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: getStaffInitialValues(user),
  });

  const name = watch("name");
  const role = watch("role");
  const username = watch("username");
  const password = watch("password");

  useEffect(() => {
    if (open) {
      setFormError(null);
      reset(getStaffInitialValues(user));
    }
  }, [open, user, reset]);

  const onSubmit = async (values: StaffFormInput) => {
    setFormError(null);

    const payload = {
      ...(isEdit && user ? { id: user.id } : {}),
      name: values.name.trim(),
      role: values.role,
      username: values.username.toLowerCase().trim(),
      password: values.password?.trim() ?? "",
    } satisfies UpdateStaffUserInput | CreateStaffUserInput;

    try {
      if (isEdit) {
        await axios.patch("/api/users", payload);
      } else {
        await axios.post("/api/users", payload);
      }

      toast.add({
        type: "success",
        title: isEdit ? "User updated" : "User created",
        description: `Account "${payload.username}" has been ${isEdit ? "successfully updated" : "created successfully"}.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "An unexpected error occurred.");
      setFormError(msg);
      toast.add({
        type: "error",
        title: isEdit ? "Failed to update user" : "Failed to create user",
        description: msg,
      });
    }
  };

  return (
    <UserDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Staff User" : "Add New Staff User"}
      description={
        isEdit
          ? "Modify account credentials and system role."
          : "Provision a new system operator or staff account."
      }
      headerIcon={isEdit ? UserEdit01Icon : UserAdd01Icon}
      formError={formError}
      isDirty={isDirty}
      isValid={isValid}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={isEdit ? "Save Changes" : "Create User"}
    >
      {/* Row 1: Full Name and System Role side-by-side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FullNameField
          value={name}
          onChange={(val) => setValue("name", val, { shouldValidate: true, shouldDirty: true })}
          placeholder="e.g. Alex Morgan"
          description="Operator name displayed in audit trails."
          error={errors.name?.message}
        />
        <SystemRoleSelect
          value={role}
          onChange={(val) => setValue("role", val, { shouldValidate: true, shouldDirty: true })}
          error={errors.role?.message}
        />
      </div>

      {/* Row 2: Username and Password side-by-side */}
      <CredentialsFields
        username={username}
        setUsername={(val) =>
          setValue("username", val, { shouldValidate: true, shouldDirty: true })
        }
        usernameError={errors.username?.message}
        password={password ?? ""}
        setPassword={(val) =>
          setValue("password", val, { shouldValidate: true, shouldDirty: true })
        }
        passwordError={errors.password?.message}
        isEdit={isEdit}
        usernamePlaceholder="e.g. alex_operator"
        usernameDescription="Unique lowercase login handle."
      />
    </UserDialogShell>
  );
}
