import type { Metadata } from "next";
import { EntriesDataTable } from "./data-table";

export const metadata: Metadata = {
  title: "Entries | Mesto",
  description: "View and record incoming and outgoing transport entries.",
};

export default function EntriesPage() {
  return <EntriesDataTable />;
}
