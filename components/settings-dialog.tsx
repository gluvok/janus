"use client";

import { useEffect, useState } from "react";
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
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/utils";
import { Factory01Icon } from "@hugeicons/core-free-icons";
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
import { useFactoryStore } from "@/stores/use-factory-store";

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
  const storeFactory = useFactoryStore((state) => state.factory);
  const [factory, setFactory] = useState<Factory | null>(storeFactory);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isDirty, isValid, isSubmitting, errors },
  } = useForm<FactoryFormInput>({
    resolver: zodResolver(factoryFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: storeFactory
      ? getFactoryFormValues(storeFactory)
      : {
          name: "",
          receipt_images_per_row: 3,
        },
  });

  const name = watch("name");
  const receiptImagesPerRow = watch("receipt_images_per_row");

  // Synchronize from cached factory store on dialog open
  useEffect(() => {
    if (open) {
      setServerError(null);
      const current = useFactoryStore.getState().factory;
      if (current) {
        setFactory(current);
        reset(getFactoryFormValues(current));
      } else {
        // Fallback fetch if store was not yet initialized
        axios
          .get<FactoryApiResponse>("/api/factories")
          .then((res) => {
            const data = res.data.data;
            setFactory(data);
            useFactoryStore.getState().setFactory(data);
            reset(getFactoryFormValues(data));
          })
          .catch((err: unknown) => {
            setServerError(getErrorMessage(err, "Failed to load factory preferences."));
          });
      }
    }
  }, [open, reset]);

  const onSubmit = async (values: FactoryFormInput) => {
    setServerError(null);
    try {
      const response = await axios.patch<FactoryApiResponse>("/api/factories", values);
      const updated = response.data.data;
      setFactory(updated);
      useFactoryStore.getState().setFactory(updated);
      reset(getFactoryFormValues(updated));

      toast.add({
        type: "success",
        title: "Settings Saved",
        description: "Factory configuration has been updated successfully.",
      });

      onOpenChange(false);
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to update factory settings.");
      setServerError(message);
      toast.add({
        type: "error",
        title: "Save Failed",
        description: message,
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

        <FormErrorBanner error={serverError} />

        <div className="relative">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 pt-1 pb-0">
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
      </DialogContent>
    </Dialog>
  );
}
