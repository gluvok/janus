import { z } from "zod";

export const TICKET_STATUSES = ["pending", "approved", "rejected"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const ticketStatusEnum = z.enum(TICKET_STATUSES);

export const ticketUserSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    username: z.string().min(1),
    factory_id: z.number().int().positive(),
  })
  .strict();
export type TicketUser = z.infer<typeof ticketUserSchema>;

export const ticketWeighmentSchema = z
  .object({
    id: z.number().int().positive(),
    vehicle_number: z.string().min(1),
  })
  .strict();
export type TicketWeighment = z.infer<typeof ticketWeighmentSchema>;

export const ticketSchema = z
  .object({
    id: z.number().int().positive(),
    concern: z.string().min(1),
    reply: z.string().nullable(),
    status: ticketStatusEnum,
    automatic_weighment_id: z.number().int().positive(),
    user_id: z.number().int().positive(),
    created_at: z.string(),
    updated_at: z.string(),
    user: ticketUserSchema,
    weighment: ticketWeighmentSchema,
  })
  .strict();

export type Ticket = z.infer<typeof ticketSchema>;

export const updateTicketSchema = z
  .object({
    id: z.number().int().positive(),
    reply: z.string().trim().max(1000).nullable().optional(),
    status: ticketStatusEnum.optional(),
  })
  .strict();

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const deleteTicketSchema = z
  .object({
    id: z.number().int().positive(),
  })
  .strict();

export type DeleteTicketInput = z.infer<typeof deleteTicketSchema>;

export const ticketFormSchema = z
  .object({
    status: ticketStatusEnum,
    reply: z.string().trim().max(1000),
  })
  .strict();

export type TicketFormInput = z.infer<typeof ticketFormSchema>;

export const TICKET_SELECT_PROJECTION =
  "id, concern, reply, status, automatic_weighment_id, user_id, created_at, updated_at, user:users!user_id!inner(id, name, username, factory_id), weighment:automatic_weighments!automatic_weighment_id!inner(id, vehicle_number)";
