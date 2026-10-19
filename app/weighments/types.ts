/**
 * @file app/weighments/types.ts
 * @description Type definitions for Weighments domain model, dual-mode tables, and relations.
 */

export type WeighmentMode = "automatic" | "manual";
export type WeighmentType = "in" | "out" | "na";

export interface WeighmentCenter {
  id: number;
  name: string;
}

export interface WeighmentCustomer {
  id: number;
  name: string;
}

export interface WeighmentEntry {
  id: number;
  vehicle_number: string;
  weight: number;
  images: string[];
  center_id: number;
  customer_id: number | null;
  created_at: string;
  center: WeighmentCenter;
  customer: WeighmentCustomer | null;
}

export interface Weighment {
  id: number;
  type: WeighmentType;
  vehicle_number: string;
  gross_weight: number;
  tare_weight: number;
  net_weight: number;
  in_entry: WeighmentEntry;
  out_entry: WeighmentEntry;
  created_at: string;
  updated_at: string;
}
