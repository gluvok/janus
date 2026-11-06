"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import {
  FormRequiredNotice,
  FormErrorBanner,
  DialogIconBadge,
  DialogActionFooter,
} from "@/components/form-primitives";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  HelpCircleIcon,
  Message01Icon,
  SecurityCheckIcon,
  Ticket01Icon,
} from "@hugeicons/core-free-icons";
import { formatDateTime, getErrorMessage } from "@/lib/utils";
import {
  ticketFormSchema,
  type TicketFormInput,
  type Ticket,
  type TicketStatus,
} from "@/app/tickets/types";

export interface TicketEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket | null;
  onSuccess: () => void;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", icon: Clock01Icon },
  { value: "approved", label: "Approved", icon: CheckmarkCircle02Icon },
  { value: "rejected", label: "Rejected", icon: CancelCircleIcon },
] as const;

function getTicketInitialValues(ticket: Ticket): TicketFormInput {
  return {
    status: ticket.status,
    reply: ticket.reply ?? "",
  };
}

export function TicketEditDialog({ open, onOpenChange, ticket, onSuccess }: TicketEditDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty, isValid, isSubmitting },
  } = useForm<TicketFormInput>({
    resolver: zodResolver(ticketFormSchema),
    mode: "onChange",
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
        status: values.status,
        reply: values.reply.trim() || null,
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
          <DialogDescription>
            Review the submitted concern and provide a resolution reply.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormErrorBanner error={serverError} />
          <FormRequiredNotice />

          {/* Ticket Context Overview Strip */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Weighment:</span> #
                {ticket.automatic_weighment_id}
              </div>
              <div>
                <span className="font-medium text-foreground">User:</span>{" "}
                {ticket.user?.name ?? `User #${ticket.user_id}`}
              </div>
              <div className="col-span-2">
                <span className="font-medium text-foreground">Created:</span>{" "}
                {formatDateTime(ticket.created_at)}
              </div>
            </div>

            <div className="border-t pt-2 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <HugeiconsIcon icon={HelpCircleIcon} className="size-3.5 text-muted-foreground" />
                <span>Concern</span>
              </div>
              <p className="text-muted-foreground whitespace-pre-wrap rounded bg-background/60 p-2 border">
                {ticket.concern}
              </p>
            </div>
          </div>

          {/* Status Selection */}
          <Field data-invalid={Boolean(errors.status)}>
            <FieldLabel htmlFor="ticket-status">
              <HugeiconsIcon icon={SecurityCheckIcon} className="size-3.5 text-muted-foreground" />
              <span>
                Status{" "}
                <span className="text-destructive font-semibold" aria-hidden="true">
                  *
                </span>
              </span>
            </FieldLabel>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select
                  items={STATUS_OPTIONS}
                  value={field.value}
                  onValueChange={(val) => {
                    if (val) field.onChange(val as TicketStatus);
                  }}
                >
                  <SelectTrigger
                    id="ticket-status"
                    className="h-8 w-full text-xs font-normal cursor-pointer"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start" className="min-w-44">
                    <SelectGroup>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          className="text-xs cursor-pointer"
                        >
                          <HugeiconsIcon
                            icon={opt.icon}
                            className="mr-1.5 size-3.5 shrink-0 text-muted-foreground"
                          />
                          <span>{opt.label}</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.status && <FieldError errors={[{ message: errors.status.message }]} />}
            <FieldDescription>Current ticket resolution lifecycle state.</FieldDescription>
          </Field>

          {/* Reply Textarea */}
          <Field data-invalid={Boolean(errors.reply)}>
            <FieldLabel htmlFor="ticket-reply">
              <HugeiconsIcon icon={Message01Icon} className="size-3.5 text-muted-foreground" />
              <span>Resolution Reply</span>
            </FieldLabel>
            <Textarea
              id="ticket-reply"
              {...register("reply")}
              placeholder="Enter explanation or resolution notes..."
              rows={3}
              className="text-xs"
            />
            {errors.reply && <FieldError errors={[{ message: errors.reply.message }]} />}
            <FieldDescription>Optional feedback sent back regarding this ticket.</FieldDescription>
          </Field>

          <DialogActionFooter
            onCancel={() => onOpenChange(false)}
            submitLabel="Save Changes"
            isSubmitting={isSubmitting}
            isDirty={isDirty}
            isValid={isValid}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
