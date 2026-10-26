/**
 * @file types/entities.ts
 * @description Core TypeScript interfaces representing the application's database entities.
 * Includes flattened and computed fields used across views and forms.
 */

import {
  Role,
  Unit,
  WeighmentType,
  EntrySource,
  EntryStatus,
  TicketStatus,
} from "@/lib/constants/enums";

/**
 * Center Entity
 * Represents physical collection centers.
 */
export interface Center {
  id: number;
  name: string;
  auto_approve: boolean;
  factory_id: number;
  created_at: string;
  updated_at: string;
  // Flattened join fields
  factory_name?: string;
}

/**
 * Commodity Entity
 * Represents raw products/materials (e.g. sugar cane, wheat).
 */
export interface Commodity {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Rate {
  id: number;
  commodity_id: number;
  unit_price: string;
  unit: Unit;
  factory_id: number;
  created_at: string;
  updated_at: string;
  // Flattened join fields
  commodity_name?: string;
  factory_name?: string;
}

export interface Customer {
  id: number;
  name: string;
  father_name: string;
  user_id?: number | null;
  factory_id: number;
  created_at: string;
  updated_at: string;
  // Flattened join fields
  username?: string;
  factory_name?: string;
}

export interface Factory {
  id: number;
  name: string;
  check_center_on_merge?: boolean;
  receipt_images_per_row?: number;
  api_key?: string | null;
  camera_crops?: Array<{
    camera: number;
    top: number;
    bottom: number;
    left: number;
    right: number;
  }>;
  created_at: string;
  updated_at: string;
}

export interface DataApiWeighmentItem {
  id: number;
  unit: Unit | string;
  type: WeighmentType | string;
  rate_id?: number | null;
  gross_weight: number;
  tare_weight: number;
  net_weight: number;
  vehicle_number: string;
  in_entry_id: number;
  in_entry_created_at?: string;
  out_entry_id: number;
  out_entry_created_at?: string;
  in_center_id?: number | null;
  in_center_name?: string;
  out_center_id?: number | null;
  out_center_name?: string;
  in_user_id?: number | null;
  in_user_name?: string;
  out_user_id?: number | null;
  out_user_name?: string;
  in_customer_id?: number | null;
  in_customer_name?: string;
  out_customer_id?: number | null;
  out_customer_name?: string;
  images: string[];
  created_at: string;
  updated_at: string;
  in_entry: Record<string, unknown>;
  out_entry: Record<string, unknown>;
}

export interface Session {
  id: number;
  token: string;
  user_id: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Entry {
  id: number;
  detected_vehicle_number?: string | null;
  vehicle_number: string;
  weight: number | string;
  source: EntrySource;
  center_id: number;
  customer_id?: number | null;
  created_by: number;
  approved_by?: number | null;
  status: EntryStatus;
  auto_approved: boolean;
  edited?: boolean;
  images: string[];
  created_at: string;
  updated_at: string;
  // Flattened join fields
  center_name?: string;
  created_by_name?: string;
  approved_by_name?: string;
  user_id?: number;
  user_name?: string;
  customer_name?: string;
  linked_weighment?: { id: number; partner_entry_id: number } | null;
}

export interface Weighment {
  id: number;
  in_entry_id: number;
  out_entry_id: number;
  unit: Unit;
  type: WeighmentType;
  rate_id?: number | null;
  created_at: string;
  updated_at: string;
  // Flattened join/computed fields
  gross_weight?: string | number;
  tare_weight?: string | number;
  net_weight?: string | number;
  vehicle_number?: string;
  in_center_id?: number | null;
  in_center_name?: string;
  out_center_id?: number | null;
  out_center_name?: string;
  user_name?: string;
  customer_name?: string;
  commodity_name?: string;
  unit_price?: string | number;
}

export interface User {
  id: number;
  username: string;
  name: string;
  role: Role;
  factory_id: number;
  password_hash?: string;
  created_at: string;
  updated_at: string;
  // Flattened join/view fields
  factory_name?: string;
}

export interface AuthUserPayload {
  sub: string;
  username: string;
  name: string;
  role: Role;
  factory_id: number;
  factory_name?: string;
  receipt_images_per_row?: number;
}

export interface Ticket {
  id: number;
  concern: string;
  reply: string | null;
  status: TicketStatus;
  entry_id: number | null;
  weighment_id: number | null;
  user_id: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  // Joined / flattened fields
  users?: { id?: number; name: string; username: string } | null;
  user_name?: string;
  user_username?: string;
  entries?: {
    id: number;
    vehicle_number: string;
    weight: number;
    status: string;
    created_at: string;
  } | null;
  weighments?: {
    id: number;
    unit: string;
    gross_weight?: number;
    tare_weight?: number;
    net_weight?: number;
    created_at: string;
    in_entry?: { vehicle_number?: string } | null;
  } | null;
}

/** Union of all entity types used across the app */
export type EntityRecord =
  | Center
  | Commodity
  | Rate
  | Customer
  | Weighment
  | Entry
  | Factory
  | User
  | Ticket;
