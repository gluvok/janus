"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, Cancel01Icon, Delete02Icon } from "@hugeicons/core-free-icons";

export interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  deleteLabel: string;
  onConfirm: () => Promise<void>;
  children?: React.ReactNode;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  deleteLabel,
  onConfirm,
  children,
}: ConfirmDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDeleteError(null);
    }
  }, [open]);

  const handleDelete = async () => {
    setDeleteError(null);
    setIsDeleting(true);

    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to delete record.");
      setDeleteError(msg);
      toast.add({
        type: "error",
        title: "Deletion blocked",
        description: msg,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md pb-3">
        <DialogHeader className="gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
            <HugeiconsIcon icon={Delete02Icon} className="size-4" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-xs">{description}</DialogDescription>
        </DialogHeader>

        {deleteError && (
          <div className="flex items-start gap-2.5 rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
            <HugeiconsIcon icon={AlertCircleIcon} className="mt-0.5 size-3.5 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Deletion Safeguard Active</span>
              <span className="text-2xs/relaxed">{deleteError}</span>
            </div>
          </div>
        )}

        {children}

        <DialogFooter className="gap-2 sm:gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
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
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="h-8 gap-1.5 text-xs"
          >
            {isDeleting ? (
              <Spinner className="size-3.5" data-icon="inline-start" />
            ) : (
              <HugeiconsIcon icon={Delete02Icon} className="size-3.5" data-icon="inline-start" />
            )}
            <span>{deleteLabel}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
