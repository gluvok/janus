import { z } from "zod";

export const TICKET_STATUSES = ["pending", "approved", "rejected"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const ticketStatusEnum = z.enum(TICKET_STATUSES);

export const ticketSchema = z
  .object({
    id: z.int().positive(),
    factory_id: z.int().positive(),
    concern: z.string().min(1),
    reply: z.string().nullable(),
    status: ticketStatusEnum,
    entry_id: z.int().positive(),
    vehicle_number: z.string().min(1),
    creator_id: z.int().positive(),
    creator_name: z.string().min(1),
    creator_username: z.string().min(1),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

export type Ticket = z.infer<typeof ticketSchema>;

export const TICKET_SELECT_PROJECTION = `
  id,
  factory_id,
  concern,
  reply,
  status,
  entry_id,
  vehicle_number,
  creator_id,
  creator_name,
  creator_username,
  created_at,
  updated_at
` as const;
