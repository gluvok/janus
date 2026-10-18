"use client";

import * as React from "react";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FormDirtyIndicator } from "@/components/form-dirty-indicator";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, Cancel01Icon } from "@hugeicons/core-free-icons";

export function FormRequiredNotice() {
  return (
    <p className="text-2xs text-muted-foreground">
      <span className="text-destructive font-semibold">*</span> indicates required field
    </p>
  );
}

export function FormErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
      <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" data-icon="inline-start" />
      <span>{error}</span>
    </div>
  );
}

export function DialogIconBadge({ icon }: { icon: Parameters<typeof HugeiconsIcon>[0]["icon"] }) {
  return (
    <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
      <HugeiconsIcon icon={icon} className="size-4" />
    </div>
  );
}

export interface DialogActionFooterProps {
  isDirty: boolean;
  isValid: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  submitLabel: string;
}

export function DialogActionFooter({
  isDirty,
  isValid,
  isSubmitting,
  onCancel,
  submitLabel,
}: DialogActionFooterProps) {
  return (
    <DialogFooter className="flex flex-row items-center justify-between sm:justify-between w-full gap-2 pt-2 border-t border-border/40">
      <FormDirtyIndicator isDirty={isDirty} className="mr-auto" />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
          className="h-8 text-xs"
        >
          <HugeiconsIcon
            icon={Cancel01Icon}
            className="size-3.5 text-muted-foreground"
            data-icon="inline-start"
          />
          <span>Cancel</span>
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!isValid || isSubmitting || !isDirty}
          className="h-8 text-xs"
        >
          {isSubmitting ? (
            <>
              <Spinner className="size-3 mr-1.5" />
              Saving...
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </DialogFooter>
  );
}
