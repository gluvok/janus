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
import { type User } from "./types";

interface UserDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  onSuccess: () => void;
}

export function UserDeleteDialog({ open, onOpenChange, users, onSuccess }: UserDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isBatch = users.length > 1;

  useEffect(() => {
    if (open) {
      setDeleteError(null);
    }
  }, [open]);

  const handleDelete = async () => {
    if (users.length === 0) return;

    setDeleteError(null);
    setIsDeleting(true);

    try {
      const payload = { ids: users.map((u) => u.id) };

      await axios.delete("/api/users", { data: payload });

      toast.add({
        type: "success",
        title: isBatch ? "Users deleted" : "User deleted",
        description: isBatch
          ? `Successfully deleted ${users.length} accounts.`
          : `Account "${users[0].username}" has been removed.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to delete user.");

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
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <HugeiconsIcon icon={Delete02Icon} className="size-4" />
            </div>
            <DialogTitle>{isBatch ? `Delete ${users.length} Users` : "Delete User"}</DialogTitle>
          </div>
          <DialogDescription>
            {isBatch
              ? `Are you sure you want to delete these ${users.length} users? Accounts with linked operational history cannot be deleted.`
              : users[0]
                ? `Are you sure you want to delete "${users[0].name}" (@${users[0].username})? Accounts with linked operational history cannot be deleted.`
                : "Confirm user deletion."}
          </DialogDescription>
        </DialogHeader>

        {deleteError ? (
          <div className="flex items-start gap-2.5 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-medium">Deletion Safeguard Active</span>
              <span className="text-2xs/relaxed">{deleteError}</span>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            {isBatch ? (
              <div className="flex flex-col gap-1.5">
                <span className="font-medium text-foreground">Targeted accounts:</span>
                <div className="flex flex-wrap gap-1">
                  {users.map((u) => (
                    <span
                      key={u.id}
                      className="rounded bg-background px-1.5 py-0.5 font-mono text-2xs text-foreground border border-border"
                    >
                      @{u.username}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <span>
                Accounts cannot be deleted if referenced by existing manual entries or support
                tickets.
              </span>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="h-8 gap-1.5 text-xs"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" data-icon="inline-start" />
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting || users.length === 0}
            className="h-8 gap-1.5 text-xs"
          >
            {isDeleting ? (
              <Spinner className="size-3.5" data-icon="inline-start" />
            ) : (
              <HugeiconsIcon icon={Delete02Icon} className="size-3.5" data-icon="inline-start" />
            )}
            {isBatch ? `Delete ${users.length} Users` : "Delete User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
