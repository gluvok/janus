"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { cn, getErrorMessage } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Factory01Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import {
  DialogActionFooter,
  DialogIconBadge,
  FormErrorBanner,
  FormRequiredNotice,
} from "@/components/form-primitives";
import {
  type Factory,
  type FactoryApiResponse,
  factoryFormSchema,
  type FactoryFormInput,
} from "@/app/settings/types";
import { FactoryForm } from "@/app/settings/factory-form";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getFactoryFormValues(f: Factory): FactoryFormInput {
  return {
    name: f.name,
    receipt_images_per_row: f.receipt_images_per_row,
  };
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [factory, setFactory] = useState<Factory | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isDirty, isValid, isSubmitting, errors },
  } = useForm<FactoryFormInput>({
    resolver: zodResolver(factoryFormSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      receipt_images_per_row: 3,
    },
  });

  const name = watch("name");
  const receiptImagesPerRow = watch("receipt_images_per_row");

  const fetchFactory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get<FactoryApiResponse>("/api/factories");
      const data = response.data.data;
      setFactory(data);
      reset(getFactoryFormValues(data));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load factory preferences."));
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    if (open) {
      fetchFactory();
    }
  }, [open, fetchFactory]);

  const onSubmit = async (values: FactoryFormInput) => {
    try {
      const response = await axios.patch<FactoryApiResponse>("/api/factories", values);
      const updated = response.data.data;
      setFactory(updated);
      reset(getFactoryFormValues(updated));

      toast.add({
        type: "success",
        title: "Settings Saved",
        description: "Factory configuration has been updated successfully.",
      });

      onOpenChange(false);
    } catch (err: unknown) {
      toast.add({
        type: "error",
        title: "Save Failed",
        description: getErrorMessage(err, "Failed to update factory settings."),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg pb-3">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogIconBadge icon={Factory01Icon} />
            <DialogTitle>Factory Settings</DialogTitle>
          </div>
          <DialogDescription>Facility identity and ticket layout.</DialogDescription>
        </DialogHeader>

        {error && !factory ? (
          <div className="flex flex-col gap-3 py-4">
            <FormErrorBanner error={error} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchFactory}
              className="w-fit gap-1.5 text-xs"
            >
              <HugeiconsIcon icon={RefreshIcon} className="size-3.5" data-icon="inline-start" />
              Retry
            </Button>
          </div>
        ) : (
          <div className="relative">
            {loading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-sm">
                <Spinner className="size-6 text-primary" />
              </div>
            )}

            <form
              onSubmit={handleSubmit(onSubmit)}
              className={cn(
                "flex flex-col gap-4 pt-1 pb-0 transition-opacity",
                loading ? "pointer-events-none opacity-40 select-none" : "opacity-100",
              )}
            >
              <FormRequiredNotice />

              <FactoryForm
                factory={factory}
                name={name}
                onNameChange={(val) =>
                  setValue("name", val, { shouldValidate: true, shouldDirty: true })
                }
                nameError={errors.name?.message}
                receiptImagesPerRow={receiptImagesPerRow}
                onReceiptImagesPerRowChange={(val) =>
                  setValue("receipt_images_per_row", val, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                receiptImagesError={errors.receipt_images_per_row?.message}
              />

              <DialogActionFooter
                isDirty={isDirty}
                isValid={isValid}
                isSubmitting={isSubmitting}
                onCancel={() => onOpenChange(false)}
                submitLabel="Save Changes"
              />
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
