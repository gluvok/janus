"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import {
  FormRequiredNotice,
  FormErrorBanner,
  DialogIconBadge,
  DialogActionFooter,
} from "@/components/form-primitives";
import { HugeiconsIcon } from "@hugeicons/react";
import { HelpCircleIcon, Message01Icon, Ticket01Icon } from "@hugeicons/core-free-icons";
import { formatDateTime, getErrorMessage } from "@/lib/utils";
import { TicketStatusBadge } from "./status-badge";
import { ticketFormSchema, type TicketFormInput, type Ticket } from "@/app/tickets/types";

export interface TicketEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket | null;
  onSuccess: () => void;
}

function getTicketInitialValues(ticket: Ticket): TicketFormInput {
  return {
    concern: ticket.concern,
  };
}

export function TicketEditDialog({ open, onOpenChange, ticket, onSuccess }: TicketEditDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<TicketFormInput>({
    resolver: zodResolver(ticketFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: ticket ? getTicketInitialValues(ticket) : undefined,
  });

  React.useEffect(() => {
    if (open && ticket) {
      setServerError(null);
      reset(getTicketInitialValues(ticket));
    }
  }, [open, ticket, reset]);

  if (!ticket) return null;

  const onSubmit = async (values: TicketFormInput) => {
    setServerError(null);
    try {
      await axios.patch("/api/tickets", {
        id: ticket.id,
        concern: values.concern.trim(),
      });
      toast.add({
        type: "success",
        title: "Ticket updated",
        description: `Ticket #${ticket.id} updated successfully.`,
      });
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to update ticket");
      setServerError(message);
      toast.add({
        type: "error",
        title: "Failed to update ticket",
        description: message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg pb-3">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <DialogIconBadge icon={Ticket01Icon} />
            <DialogTitle>Update Ticket #{ticket.id}</DialogTitle>
          </div>
          <DialogDescription>Update your submitted concern for this weighment.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormErrorBanner error={serverError} />
          <FormRequiredNotice />

          {/* Ticket Context Overview Strip */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">Weighment:</span>
                  <span className="font-semibold text-foreground">
                    #{ticket.automatic_weighment_id}
                  </span>
                  <span className="font-mono font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded text-2xs">
                    {ticket.weighment.vehicle_number}
                  </span>
                </div>
                <div className="text-muted-foreground text-2xs">
                  <span className="font-medium text-foreground">Created:</span>{" "}
                  {formatDateTime(ticket.created_at)}
                </div>
              </div>
              <TicketStatusBadge status={ticket.status} />
            </div>

            {ticket.reply && (
              <div className="border-t pt-2 space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <HugeiconsIcon icon={Message01Icon} className="size-3.5 text-muted-foreground" />
                  <span>Resolution Reply</span>
                </div>
                <p className="text-muted-foreground whitespace-pre-wrap rounded bg-background/60 p-2 border">
                  {ticket.reply}
                </p>
              </div>
            )}
          </div>

          {/* Concern Textarea */}
          <Field data-invalid={Boolean(errors.concern)}>
            <FieldLabel htmlFor="ticket-concern">
              <HugeiconsIcon icon={HelpCircleIcon} className="size-3.5 text-muted-foreground" />
              <span>
                Concern{" "}
                <span className="text-destructive font-semibold" aria-hidden="true">
                  *
                </span>
              </span>
            </FieldLabel>
            <Textarea
              id="ticket-concern"
              {...register("concern")}
              placeholder="Describe your concern or issue with this weighment..."
              rows={4}
              className="text-xs"
            />
            {errors.concern && <FieldError errors={[{ message: errors.concern.message }]} />}
            <FieldDescription>Explain what needs correction or review.</FieldDescription>
          </Field>

          <DialogActionFooter
            onCancel={() => onOpenChange(false)}
            submitLabel="Save Changes"
            isSubmitting={isSubmitting}
            isDirty={isDirty}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
