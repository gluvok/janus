"use client";

import axios from "axios";
import { toast } from "@/components/ui/toast";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { type User } from "./types";

export interface SingleUserDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSuccess: () => void;
}

export function SingleUserDeleteDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: SingleUserDeleteDialogProps) {
  if (!user) return null;

  const handleConfirm = async () => {
    await axios.delete("/api/users", { data: { ids: [user.id] } });

    toast.add({
      type: "success",
      title: "User deleted",
      description: `Account "${user.username}" has been removed.`,
    });

    onSuccess();
  };

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete User"
      description={`Are you sure you want to delete "${user.name}" (@${user.username})? Accounts with linked operational history cannot be deleted.`}
      deleteLabel="Delete User"
      onConfirm={handleConfirm}
    >
      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Accounts cannot be deleted if referenced by existing scale entries.
      </div>
    </ConfirmDeleteDialog>
  );
}

export interface BatchUsersDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  onSuccess: () => void;
}

export function BatchUsersDeleteDialog({
  open,
  onOpenChange,
  users,
  onSuccess,
}: BatchUsersDeleteDialogProps) {
  if (users.length === 0) return null;

  const count = users.length;

  const handleConfirm = async () => {
    const payload = { ids: users.map((u) => u.id) };
    await axios.delete("/api/users", { data: payload });

    toast.add({
      type: "success",
      title: "Users deleted",
      description: `Successfully deleted ${count} accounts.`,
    });

    onSuccess();
  };

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${count} Users`}
      description={`Are you sure you want to delete these ${count} users? Accounts with linked operational history cannot be deleted.`}
      deleteLabel={`Delete ${count} Users`}
      onConfirm={handleConfirm}
    >
      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground flex flex-col gap-1.5">
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
    </ConfirmDeleteDialog>
  );
}
