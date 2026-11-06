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
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, Cancel01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import type { Ticket } from "./types";

interface TicketDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket | null;
  onSuccess: () => void;
}

export function TicketDeleteDialog({
  open,
  onOpenChange,
  ticket,
  onSuccess,
}: TicketDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDeleteError(null);
    }
  }, [open]);

  if (!ticket) return null;

  const handleDelete = async () => {
    setDeleteError(null);
    setIsDeleting(true);

    try {
      await axios.delete("/api/tickets", { data: { id: ticket.id } });

      toast.add({
        type: "success",
        title: "Ticket deleted",
        description: `Ticket #${ticket.id} has been permanently deleted.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to delete ticket.");
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
            <HugeiconsIcon icon={Delete02Icon} className="size-4" />
          </div>
          <DialogTitle>Delete Pending Ticket #{ticket.id}?</DialogTitle>
          <DialogDescription className="text-xs">
            This action cannot be undone. This pending ticket record will be permanently deleted
            from the database.
          </DialogDescription>
        </DialogHeader>

        {deleteError && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-2.5 text-xs text-destructive border border-destructive/20">
            <HugeiconsIcon icon={AlertCircleIcon} className="mt-0.5 size-3.5 shrink-0" />
            <span>{deleteError}</span>
          </div>
        )}

        <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5 text-xs">
          <div>
            <span className="font-medium text-foreground">Weighment:</span> #
            {ticket.automatic_weighment_id}
            <span className="ml-1.5 font-mono font-semibold text-foreground">
              ({ticket.weighment.vehicle_number})
            </span>
          </div>
          <div>
            <span className="font-medium text-foreground">Concern:</span>
            <p className="text-muted-foreground truncate">{ticket.concern}</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="text-xs"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-xs"
          >
            {isDeleting ? (
              <>
                <Spinner className="size-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                Confirm Deletion
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
