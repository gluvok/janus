import type { Metadata } from "next";
import { EntriesDataTable } from "../data-table";

export const metadata: Metadata = {
  title: "Automatic Entries | Mesto",
  description: "View and manage automatic raw scale readings and vehicle plate entries.",
};

export default function AutomaticEntriesPage() {
  return <EntriesDataTable mode="automatic" />;
}
