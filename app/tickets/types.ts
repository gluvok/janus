import { z } from "zod";

export const TICKET_STATUSES = ["pending", "approved", "rejected"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const ticketStatusEnum = z.enum(TICKET_STATUSES);

export const ticketEntrySchema = z
  .object({
    id: z.int().positive(),
    vehicle_number: z.string().min(1),
  })
  .strict();
export type TicketEntry = z.infer<typeof ticketEntrySchema>;

export const ticketSchema = z
  .object({
    id: z.int().positive(),
    concern: z.string().min(1),
    reply: z.string().nullable(),
    status: ticketStatusEnum,
    entry_id: z.int().positive(),
    created_at: z.string(),
    updated_at: z.string(),
    entry: ticketEntrySchema,
  })
  .strict();

export type Ticket = z.infer<typeof ticketSchema>;

export const TICKET_SELECT_PROJECTION =
  "id, concern, reply, status, entry_id, created_at, updated_at, entry:entries!entry_id!inner(id, vehicle_number, center:centers!center_id!inner(factory_id))";
