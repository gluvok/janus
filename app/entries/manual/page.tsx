import type { Metadata } from "next";
import { EntriesDataTable } from "../data-table";

export const metadata: Metadata = {
  title: "Manual Entries | Mesto",
  description: "View and manage manually recorded scale readings and vehicle plate entries.",
};

export default function ManualEntriesPage() {
  return <EntriesDataTable mode="manual" />;
}
