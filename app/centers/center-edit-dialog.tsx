"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field";
import {
  FormRequiredNotice,
  FormErrorBanner,
  DialogIconBadge,
  DialogActionFooter,
} from "@/components/form-primitives";
import { Building01Icon } from "@hugeicons/core-free-icons";
import { updateCenterSchema, type UpdateCenterInput, type Center } from "@/app/centers/types";
import { getErrorMessage } from "@/lib/utils";

export interface CenterEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  center: Center | null;
  onSuccess: () => void;
}

export function CenterEditDialog({ open, onOpenChange, center, onSuccess }: CenterEditDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid, isSubmitting },
  } = useForm<UpdateCenterInput>({
    resolver: zodResolver(updateCenterSchema),
    mode: "onChange",
    defaultValues: {
      id: center?.id ?? 0,
      name: center?.name ?? "",
    },
  });

  React.useEffect(() => {
    if (open && center) {
      setServerError(null);
      reset({
        id: center.id,
        name: center.name,
      });
    }
  }, [open, center, reset]);

  const onSubmit = async (values: UpdateCenterInput) => {
    if (!center) return;
    setServerError(null);
    try {
      await axios.patch("/api/centers", {
        id: center.id,
        name: values.name,
      });
      toast.add({
        type: "success",
        title: "Center updated",
        description: `Center "${values.name}" updated successfully.`,
      });
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to update center");
      setServerError(message);
      toast.add({
        type: "error",
        title: "Failed to update center",
        description: message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md pb-3">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <DialogIconBadge icon={Building01Icon} />
            <DialogTitle>Edit Center</DialogTitle>
          </div>
          <DialogDescription>Update the name of this weighment center.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormErrorBanner error={serverError} />

          <div className="space-y-1.5">
            <Label htmlFor="center-name" className="text-xs font-medium">
              Center Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="center-name"
              placeholder="e.g. North Gate Scale"
              {...register("name")}
              aria-invalid={!!errors.name}
              className="text-xs"
            />
            {errors.name?.message && <FieldError>{errors.name.message}</FieldError>}
          </div>

          <FormRequiredNotice />

          <DialogActionFooter
            onCancel={() => onOpenChange(false)}
            isSubmitting={isSubmitting}
            isValid={isValid}
            isDirty={isDirty}
            submitLabel="Save Changes"
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
