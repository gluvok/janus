import type { AutomaticWeighment, ManualWeighment } from "@/app/weighments/types";
import type { AutomaticEntry, ManualEntry } from "@/app/entries/types";
import type { UserRole } from "@/app/users/types";

export type WeighmentReceiptData =
  | AutomaticWeighment
  | (ManualWeighment & {
      in_creator_role?: UserRole;
      out_creator_role?: UserRole;
    });

export type EntryReceiptData =
  | Omit<AutomaticEntry, "idempotency_key">
  | (ManualEntry & {
      creator_role?: UserRole;
    });
