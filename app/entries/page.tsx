import type { Metadata } from "next";
import { EntriesDataTable } from "./data-table";

export const metadata: Metadata = {
  title: "Entries | Mesto",
  description: "View and manage raw scale readings and vehicle plate entries.",
};

export default function EntriesPage() {
  return <EntriesDataTable />;
}
