"use client";

import axios from "axios";
import { toast } from "@/components/ui/toast";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
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
  if (!ticket) return null;

  const handleConfirm = async () => {
    await axios.delete("/api/tickets", { data: { id: ticket.id } });

    toast.add({
      type: "success",
      title: "Ticket deleted",
      description: `Ticket #${ticket.id} has been permanently deleted.`,
    });

    onSuccess();
  };

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete Pending Ticket #${ticket.id}?`}
      description="This action cannot be undone. This pending ticket record will be permanently deleted from the database."
      deleteLabel="Delete Ticket"
      onConfirm={handleConfirm}
    >
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
    </ConfirmDeleteDialog>
  );
}
