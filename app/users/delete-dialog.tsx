"use client";

import axios from "axios";
import { toast } from "@/components/ui/toast";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { type User } from "./types";

interface UserDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  onSuccess: () => void;
}

export function UserDeleteDialog({ open, onOpenChange, users, onSuccess }: UserDeleteDialogProps) {
  const isBatch = users.length > 1;

  const handleConfirm = async () => {
    if (users.length === 0) return;

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
  };

  const title = isBatch ? `Delete ${users.length} Users` : "Delete User";
  const description = isBatch
    ? `Are you sure you want to delete these ${users.length} users? Accounts with linked operational history cannot be deleted.`
    : users[0]
      ? `Are you sure you want to delete "${users[0].name}" (@${users[0].username})? Accounts with linked operational history cannot be deleted.`
      : "Confirm user deletion.";

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      deleteLabel={isBatch ? `Delete ${users.length} Users` : "Delete User"}
      onConfirm={handleConfirm}
    >
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
            Accounts cannot be deleted if referenced by existing manual weighments or support
            tickets.
          </span>
        )}
      </div>
    </ConfirmDeleteDialog>
  );
}
