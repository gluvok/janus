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
import { UserGroupIcon } from "@hugeicons/core-free-icons";
import {
  createCustomerSchema,
  type CreateCustomerInput,
  type Customer,
} from "@/app/customers/types";
import { getErrorMessage } from "@/lib/utils";

export interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  onSuccess: () => void;
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSuccess,
}: CustomerFormDialogProps) {
  const isEdit = !!customer;
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid, isSubmitting },
  } = useForm<CreateCustomerInput>({
    resolver: zodResolver(createCustomerSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      setServerError(null);
      reset({
        name: customer?.name ?? "",
      });
    }
  }, [open, customer, reset]);

  const onSubmit = async (values: CreateCustomerInput) => {
    setServerError(null);
    try {
      if (isEdit && customer) {
        await axios.patch("/api/customers", {
          id: customer.id,
          name: values.name,
        });
        toast.add({
          type: "success",
          title: "Customer updated",
          description: `Customer "${values.name}" updated successfully.`,
        });
      } else {
        await axios.post("/api/customers", values);
        toast.add({
          type: "success",
          title: "Customer created",
          description: `Customer "${values.name}" created successfully.`,
        });
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to save customer");
      setServerError(message);
      toast.add({
        type: "error",
        title: isEdit ? "Failed to update customer" : "Failed to create customer",
        description: message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-1.5 pb-2">
          <div className="flex items-center gap-2.5">
            <DialogIconBadge icon={UserGroupIcon} />
            <DialogTitle>{isEdit ? "Edit Customer" : "Create Customer"}</DialogTitle>
          </div>
          <DialogDescription>
            {isEdit
              ? "Update the customer profile details."
              : "Register a new transport or weighbridge customer profile."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormErrorBanner error={serverError} />

          <div className="space-y-1.5">
            <Label htmlFor="customer-name" className="text-xs font-medium">
              Customer Name <span className="text-destructive font-semibold">*</span>
            </Label>
            <Input
              id="customer-name"
              placeholder="e.g. Acme Transport Logistics"
              className="h-8 text-xs"
              {...register("name")}
            />
            {errors.name?.message && <FieldError>{errors.name.message}</FieldError>}
          </div>

          <FormRequiredNotice />

          <DialogActionFooter
            isDirty={isDirty}
            isValid={isValid}
            isSubmitting={isSubmitting}
            onCancel={() => onOpenChange(false)}
            submitLabel={isEdit ? "Save Changes" : "Create Customer"}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
