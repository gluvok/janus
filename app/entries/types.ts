export interface EntryCenter {
  id: number;
  name: string;
}

export interface EntryCustomer {
  id: number;
  name: string;
}

export interface EntryDevice {
  id: number;
}

export interface EntryOperator {
  id: number;
  name: string;
  role?: string;
}

export interface BaseEntry {
  id: number;
  vehicle_number: string;
  weight: number;
  center_id: number;
  customer_id: number | null;
  images: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  center?: EntryCenter | null;
  customer?: EntryCustomer | null;
}

export interface AutomaticEntry extends BaseEntry {
  device_id: number;
  detected_vehicle_number: string;
  device?: EntryDevice | null;
}

export interface ManualEntry extends BaseEntry {
  creator_id: number;
  creator?: EntryOperator | null;
}

export type Entry = AutomaticEntry | ManualEntry;

export type EntryMode = "automatic" | "manual";

export function isAutomaticEntry(entry: Entry): entry is AutomaticEntry {
  return "device_id" in entry;
}

export function isManualEntry(entry: Entry): entry is ManualEntry {
  return "creator_id" in entry;
}
