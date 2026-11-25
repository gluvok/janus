/**
 * @file app/tickets/types.ts
 * @description Type definitions and Zod schemas for Automatic and Manual Tickets domain models.
 */

import { z } from "zod";
import { userRoleEnum } from "@/app/users/types";

export const TICKET_STATUSES = ["pending", "approved", "rejected"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const ticketStatusEnum = z.enum(TICKET_STATUSES);

const baseTicketFields = {
  id: z.int().positive(),
  factory_id: z.int().positive(),
  concern: z.string().min(1),
  reply: z.string().nullable(),
  status: ticketStatusEnum,
  entry_id: z.int().positive(),
  vehicle_number: z.string().min(1),
  center_id: z.int().positive(),
  center_name: z.string().min(1),
  creator_id: z.int().positive(),
  creator_name: z.string().min(1),
  creator_username: z.string().min(1),
  creator_role: userRoleEnum,
  created_at: z.string(),
  updated_at: z.string(),
};

export const automaticTicketSchema = z
  .object({
    ...baseTicketFields,
  })
  .strict();

export type AutomaticTicket = z.infer<typeof automaticTicketSchema>;

export const AUTOMATIC_TICKET_SELECT_PROJECTION = `
  id,
  factory_id,
  concern,
  reply,
  status,
  entry_id,
  vehicle_number,
  center_id,
  center_name,
  creator_id,
  creator_name,
  creator_username,
  creator_role,
  created_at,
  updated_at
` as const;

export const manualTicketSchema = z
  .object({
    ...baseTicketFields,
    entry_creator_id: z.int().positive(),
    entry_creator_name: z.string().min(1),
    entry_creator_username: z.string().min(1),
    entry_creator_role: userRoleEnum,
  })
  .strict();

export type ManualTicket = z.infer<typeof manualTicketSchema>;

export const MANUAL_TICKET_SELECT_PROJECTION = `
  id,
  factory_id,
  concern,
  reply,
  status,
  entry_id,
  vehicle_number,
  center_id,
  center_name,
  creator_id,
  creator_name,
  creator_username,
  creator_role,
  entry_creator_id,
  entry_creator_name,
  entry_creator_username,
  entry_creator_role,
  created_at,
  updated_at
` as const;

export const ticketSchema = z.union([automaticTicketSchema, manualTicketSchema]);
export type Ticket = AutomaticTicket | ManualTicket;
