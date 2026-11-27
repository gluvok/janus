"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/utils";
import { UserAdd01Icon, UserEdit01Icon } from "@hugeicons/core-free-icons";
import { UserDialogShell, UserFormFields } from "./dialog-primitives";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type User,
} from "./types";

export interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const INITIAL_CREATE_VALUES: CreateUserInput = {
  name: "",
  role: "operator",
  username: "",
  password: "",
};

export function CreateUserDialog({ open, onOpenChange, onSuccess }: CreateUserDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isDirty, isValid, isSubmitting, errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: INITIAL_CREATE_VALUES,
  });

  const name = watch("name");
  const role = watch("role");
  const username = watch("username");
  const password = watch("password");

  useEffect(() => {
    if (open) {
      reset(INITIAL_CREATE_VALUES);
      setFormError(null);
    }
  }, [open, reset]);

  const onSubmit = async (values: CreateUserInput) => {
    setFormError(null);
    const payload: CreateUserInput = {
      name: values.name.trim(),
      role: values.role,
      username: values.username.toLowerCase().trim(),
      password: values.password.trim(),
    };

    try {
      await axios.post("/api/users", payload);

      toast.add({
        type: "success",
        title: "User created",
        description: `Account "${payload.username}" has been created successfully.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "An unexpected error occurred.");
      setFormError(msg);
      toast.add({
        type: "error",
        title: "Failed to create user",
        description: msg,
      });
    }
  };

  return (
    <UserDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Add New Staff User"
      description="Provision a new system operator or staff account."
      headerIcon={UserAdd01Icon}
      formError={formError}
      isDirty={isDirty}
      isValid={isValid}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit(onSubmit)}
      submitLabel="Create User"
    >
      <UserFormFields
        name={name}
        setName={(val) => setValue("name", val, { shouldValidate: true, shouldDirty: true })}
        nameError={errors.name?.message}
        role={role}
        setRole={(val) => setValue("role", val, { shouldValidate: true, shouldDirty: true })}
        roleError={errors.role?.message}
        username={username}
        setUsername={(val) =>
          setValue("username", val, { shouldValidate: true, shouldDirty: true })
        }
        usernameError={errors.username?.message}
        password={password}
        setPassword={(val) =>
          setValue("password", val, { shouldValidate: true, shouldDirty: true })
        }
        passwordError={errors.password?.message}
        isPasswordRequired={true}
      />
    </UserDialogShell>
  );
}

export interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onSuccess: () => void;
}

function getEditInitialValues(user: User): UpdateUserInput {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    username: user.username,
    password: "",
  };
}

export function EditUserDialog({ open, onOpenChange, user, onSuccess }: EditUserDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isDirty, isValid, isSubmitting, errors },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: getEditInitialValues(user),
  });

  const name = watch("name");
  const role = watch("role");
  const username = watch("username");
  const password = watch("password");

  useEffect(() => {
    if (open) {
      reset(getEditInitialValues(user));
      setFormError(null);
    }
  }, [open, user, reset]);

  const onSubmit = async (values: UpdateUserInput) => {
    setFormError(null);
    const payload: UpdateUserInput = {
      id: user.id,
      name: values.name.trim(),
      role: values.role,
      username: values.username.toLowerCase().trim(),
      ...(values.password?.trim() ? { password: values.password.trim() } : {}),
    };

    try {
      await axios.patch("/api/users", payload);

      toast.add({
        type: "success",
        title: "User updated",
        description: `Account "${payload.username}" has been successfully updated.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "An unexpected error occurred.");
      setFormError(msg);
      toast.add({
        type: "error",
        title: "Failed to update user",
        description: msg,
      });
    }
  };

  return (
    <UserDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Staff User"
      description="Modify account credentials and system role."
      headerIcon={UserEdit01Icon}
      formError={formError}
      isDirty={isDirty}
      isValid={isValid}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit(onSubmit)}
      submitLabel="Save Changes"
    >
      <UserFormFields
        name={name}
        setName={(val) => setValue("name", val, { shouldValidate: true, shouldDirty: true })}
        nameError={errors.name?.message}
        role={role}
        setRole={(val) => setValue("role", val, { shouldValidate: true, shouldDirty: true })}
        roleError={errors.role?.message}
        username={username}
        setUsername={(val) =>
          setValue("username", val, { shouldValidate: true, shouldDirty: true })
        }
        usernameError={errors.username?.message}
        password={password}
        setPassword={(val) =>
          setValue("password", val, { shouldValidate: true, shouldDirty: true })
        }
        passwordError={errors.password?.message}
        isPasswordRequired={false}
      />
    </UserDialogShell>
  );
}
