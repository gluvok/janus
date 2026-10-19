"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormRequiredNotice,
  FormErrorBanner,
  DialogIconBadge,
  DialogActionFooter,
} from "@/components/form-primitives";
import { TruckIcon, LockIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  normalizeVehicleNumber,
  createAutomaticEntryFormSchema,
  type AutomaticEntryFormData,
} from "@/lib/validation";
import { getErrorMessage } from "@/lib/utils";
import type { AutomaticEntry } from "@/app/entries/types";

interface OptionItem {
  label: string;
  value: string;
}

export interface AutomaticEntryEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: AutomaticEntry | null;
  onSuccess: () => void;
}

export function AutomaticEntryEditDialog({
  open,
  onOpenChange,
  entry,
  onSuccess,
}: AutomaticEntryEditDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [customers, setCustomers] = React.useState<OptionItem[]>([]);

  // Conditional lock flags for automatic entries
  const canEditVehicle = Boolean(entry && entry.vehicle_number === entry.detected_vehicle_number);
  const canEditCustomer = Boolean(
    entry && (entry.customer_id === null || entry.customer_id === undefined),
  );

  const formSchema = React.useMemo(() => {
    return createAutomaticEntryFormSchema({
      canEditVehicle,
      canEditCustomer,
    });
  }, [canEditVehicle, canEditCustomer]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting, isDirty, isValid },
  } = useForm<AutomaticEntryFormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      vehicle_number: "",
      customer_id: "none",
    },
  });

  // Load customers for selection when dialog opens
  React.useEffect(() => {
    if (!open) return;

    let isMounted = true;
    async function loadCustomers() {
      try {
        const res = await axios.get<{ data: Array<{ id: number; name: string }> }>(
          "/api/customers?all=true",
        );
        if (isMounted) {
          setCustomers([
            { label: "Unassigned", value: "none" },
            ...res.data.data.map((c) => ({
              label: c.name,
              value: String(c.id),
            })),
          ]);
        }
      } catch {
        // Ignored; options remain empty
      }
    }

    loadCustomers();
    return () => {
      isMounted = false;
    };
  }, [open]);

  // Sync form values on open/entry change
  React.useEffect(() => {
    if (open && entry) {
      setServerError(null);
      reset({
        vehicle_number: entry.vehicle_number,
        customer_id: entry.customer_id ? String(entry.customer_id) : "none",
      });
    }
  }, [open, entry, reset]);

  const onSubmit = async (values: AutomaticEntryFormData) => {
    if (!entry) return;
    setServerError(null);

    try {
      const payload: Record<string, unknown> = { id: entry.id };

      if (canEditVehicle && values.vehicle_number) {
        payload.vehicle_number = normalizeVehicleNumber(values.vehicle_number);
      }
      if (canEditCustomer) {
        payload.customer_id =
          values.customer_id && values.customer_id !== "none" ? Number(values.customer_id) : null;
      }

      await axios.patch("/api/entries/automatic", payload);

      toast.add({
        type: "success",
        title: "Automatic entry updated",
        description: "Entry details updated successfully.",
      });

      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to update entry");
      setServerError(message);
      toast.add({
        type: "error",
        title: "Failed to update entry",
        description: message,
      });
    }
  };

  const hasEditableFields = canEditVehicle || canEditCustomer;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogIconBadge icon={TruckIcon} />
            <div>
              <DialogTitle className="text-base">Edit Automatic Entry</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Correct vehicle plate or assign customer for this automatic capture.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {hasEditableFields ? (
            <FormRequiredNotice />
          ) : (
            <p className="text-xs text-muted-foreground">
              All details for this entry have already been locked and cannot be edited.
            </p>
          )}
          <FormErrorBanner error={serverError} />

          {/* Vehicle Number: Editable or Locked Card */}
          {canEditVehicle ? (
            <div className="space-y-1.5">
              <Label htmlFor="entry-vehicle-number" className="text-xs font-medium">
                Vehicle Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="entry-vehicle-number"
                {...register("vehicle_number", {
                  onChange: (e) => {
                    setValue("vehicle_number", normalizeVehicleNumber(e.target.value), {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  },
                })}
                placeholder="e.g. MH12AB1028"
                className="h-8 text-xs font-mono uppercase"
              />
              {errors.vehicle_number?.message && (
                <FieldError errors={[{ message: errors.vehicle_number.message }]} />
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Vehicle Number</span>
                <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                  <HugeiconsIcon icon={LockIcon} className="size-3 text-muted-foreground" />
                  <span>Corrected from capture</span>
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-stone-200/80 bg-stone-500/5 px-3 py-2 text-xs dark:border-stone-800 dark:bg-stone-900/30">
                <span className="font-mono font-medium uppercase text-foreground">
                  {entry?.vehicle_number}
                </span>
                {entry?.detected_vehicle_number &&
                  entry.detected_vehicle_number !== entry.vehicle_number && (
                    <span className="text-2xs text-muted-foreground">
                      Detected: {entry.detected_vehicle_number}
                    </span>
                  )}
              </div>
            </div>
          )}

          {/* Customer: Editable Dropdown or Locked Card */}
          {canEditCustomer ? (
            <div className="space-y-1.5">
              <Label htmlFor="entry-customer" className="text-xs font-medium">
                Customer
              </Label>
              <Controller
                name="customer_id"
                control={control}
                render={({ field }) => (
                  <Select
                    items={customers}
                    value={field.value}
                    onValueChange={(val) => {
                      field.onChange(val ?? "none");
                    }}
                  >
                    <SelectTrigger id="entry-customer" className="h-8 text-xs">
                      <SelectValue placeholder="Select customer (optional)" />
                    </SelectTrigger>
                    <SelectContent align="start" className="min-w-48 max-h-48">
                      <SelectGroup>
                        {customers.map((c) => (
                          <SelectItem key={c.value} value={c.value} className="text-xs">
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.customer_id?.message && (
                <FieldError errors={[{ message: errors.customer_id.message }]} />
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Customer</span>
                <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                  <HugeiconsIcon icon={LockIcon} className="size-3 text-muted-foreground" />
                  <span>Assigned</span>
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-stone-200/80 bg-stone-500/5 px-3 py-2 text-xs dark:border-stone-800 dark:bg-stone-900/30">
                <span className="font-medium text-foreground">
                  {entry?.customer?.name ?? "Assigned"}
                </span>
              </div>
            </div>
          )}

          <DialogActionFooter
            onCancel={() => onOpenChange(false)}
            isSubmitting={isSubmitting}
            isDirty={isDirty && hasEditableFields}
            isValid={isValid && hasEditableFields}
            submitLabel="Save Changes"
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
