"use client";

import { useEffect, useState } from "react";
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
} from "./dialog-primitives";
import {
  USER_FORM_SCHEMAS,
  type CreateUserInput,
  type UserFormInput,
  type UpdateUserInput,
  type User,
} from "./types";

interface StaffUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  onSuccess: () => void;
}

type DialogMode = "edit" | "create";

const DIALOG_CONFIGS: Record<
  DialogMode,
  {
    title: string;
    description: string;
    icon: typeof UserEdit01Icon;
    submitLabel: string;
    successTitle: string;
    actionPastTense: string;
    errorTitle: string;
    submit: (payload: UpdateUserInput | CreateUserInput) => Promise<unknown>;
  }
> = {
  edit: {
    title: "Edit Staff User",
    description: "Modify account credentials and system role.",
    icon: UserEdit01Icon,
    submitLabel: "Save Changes",
    successTitle: "User updated",
    actionPastTense: "successfully updated",
    errorTitle: "Failed to update user",
    submit: (payload) => axios.patch("/api/users", payload),
  },
  create: {
    title: "Add New Staff User",
    description: "Provision a new system operator or staff account.",
    icon: UserAdd01Icon,
    submitLabel: "Create User",
    successTitle: "User created",
    actionPastTense: "created successfully",
    errorTitle: "Failed to create user",
    submit: (payload) => axios.post("/api/users", payload),
  },
};

function getStaffInitialValues(user?: User | null): UserFormInput {
  if (user) {
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      username: user.username,
      password: "",
    };
  }
  return {
    name: "",
    role: "operator",
    username: "",
    password: "",
  };
}

export function StaffUserDialog({ open, onOpenChange, user, onSuccess }: StaffUserDialogProps) {
  const isEdit = Boolean(user);
  const modeKey: DialogMode = isEdit ? "edit" : "create";
  const config = DIALOG_CONFIGS[modeKey];
  const schema = USER_FORM_SCHEMAS[modeKey];

  const [formError, setFormError] = useState<string | null>(null);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isDirty, isValid, isSubmitting, errors },
  } = useForm<UserFormInput>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: getStaffInitialValues(user),
  });

  const name = watch("name");
  const role = watch("role");
  const username = watch("username");
  const password = watch("password");

  useEffect(() => {
    if (open) {
      reset(getStaffInitialValues(user));
      setFormError(null);
    }
  }, [open, user, reset]);

  const onSubmit = async (values: UserFormInput) => {
    setFormError(null);

    const payload = {
      ...(isEdit && user ? { id: user.id } : {}),
      name: values.name.trim(),
      role: values.role,
      username: values.username.toLowerCase().trim(),
      password: values.password?.trim() ?? "",
    } as UpdateUserInput | CreateUserInput;

    try {
      await config.submit(payload);

      toast.add({
        type: "success",
        title: config.successTitle,
        description: `Account "${payload.username}" has been ${config.actionPastTense}.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "An unexpected error occurred.");
      setFormError(msg);
      toast.add({
        type: "error",
        title: config.errorTitle,
        description: msg,
      });
    }
  };

  return (
    <UserDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={config.title}
      description={config.description}
      headerIcon={config.icon}
      formError={formError}
      isDirty={isDirty}
      isValid={isValid}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={config.submitLabel}
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
        isPasswordRequired={!isEdit}
        usernamePlaceholder="e.g. alex_operator"
        usernameDescription="Unique lowercase login handle."
      />
    </UserDialogShell>
  );
}
