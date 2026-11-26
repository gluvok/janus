"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/utils";
import { vehicleNumberSchema } from "@/lib/validation/helpers";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Edit01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import type { Weighment } from "./types";

const correctPlateSchema = vehicleNumberSchema.refine((v) => v.length >= 8 && v.length <= 11, {
  message: "Vehicle number must be between 8 and 11 characters.",
});

export interface CorrectPlateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weighment: Weighment | null;
  onSuccess: () => void;
}

export function CorrectPlateDialog({
  open,
  onOpenChange,
  weighment,
  onSuccess,
}: CorrectPlateDialogProps) {
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !weighment) return;

    setVehicleNumber(weighment.vehicle_number);
    setValidationError(null);
    setSubmitError(null);
  }, [open, weighment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weighment) return;

    setValidationError(null);
    setSubmitError(null);

    const parsed = correctPlateSchema.safeParse(vehicleNumber);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Invalid vehicle number.");
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.patch("/api/weighments/automatic", {
        id: weighment.id,
        vehicle_number: parsed.data,
      });
      toast.add({
        type: "success",
        title: "Plate updated",
        description: `Weighment #${weighment.id} updated to ${parsed.data}.`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to update vehicle plate.");
      setSubmitError(msg);
      toast.add({
        type: "error",
        title: "Plate correction failed",
        description: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader className="gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <HugeiconsIcon icon={Edit01Icon} className="size-4" />
            </div>
            <DialogTitle>Correct Vehicle Plate</DialogTitle>
            <DialogDescription className="text-xs">
              Update the vehicle registration number for weighment #{weighment?.id} and both of its
              linked automatic entries.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning-foreground">
            <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground">One-Time Operation Only</span>
              <span className="text-2xs/relaxed text-muted-foreground">
                A weighment plate can only be corrected once. Any further changes will require
                contacting an administrator.
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Linked Entries</span>
            {weighment && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    label: "In Entry",
                    id: weighment.in_entry_id,
                    weight: weighment.type === "out" ? weighment.tare : weighment.gross,
                  },
                  {
                    label: "Out Entry",
                    id: weighment.out_entry_id,
                    weight: weighment.type === "out" ? weighment.gross : weighment.tare,
                  },
                ].map((entry) => (
                  <div
                    key={entry.label}
                    className="flex flex-col gap-1 rounded-md border bg-muted/30 p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-2xs text-muted-foreground">
                      <span>{entry.label}</span>
                      <span className="font-mono">#{entry.id}</span>
                    </div>
                    <span className="font-mono font-semibold text-foreground">
                      {weighment.vehicle_number}
                    </span>
                    <span className="font-mono text-2xs text-muted-foreground">
                      {Number(entry.weight).toLocaleString()} kg
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Field data-invalid={!!validationError || undefined}>
            <FieldLabel htmlFor="correct-plate-input">New Vehicle Number</FieldLabel>
            <Input
              id="correct-plate-input"
              value={vehicleNumber}
              onChange={(e) => {
                setVehicleNumber(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="e.g. MH12AB1234"
              disabled={isSubmitting}
              aria-invalid={!!validationError || undefined}
              className="font-mono uppercase"
              autoComplete="off"
            />
            {validationError && <FieldError errors={[{ message: validationError }]} />}
          </Field>

          {submitError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
              <HugeiconsIcon icon={AlertCircleIcon} className="mt-0.5 size-3.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 gap-1.5 text-xs">
              {isSubmitting ? (
                <Spinner className="size-3.5" data-icon="inline-start" />
              ) : (
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  className="size-3.5"
                  data-icon="inline-start"
                />
              )}
              <span>Update Plate</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface ContactAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
}

export function ContactAdminDialog({
  open,
  onOpenChange,
  title,
  description,
}: ContactAdminDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
            <HugeiconsIcon icon={InformationCircleIcon} className="size-4" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-xs">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
