import type { Metadata } from "next";
import { TicketsDataTable } from "./data-table";

export const metadata: Metadata = {
  title: "Tickets | Mesto",
  description: "Support tickets and issue tracking.",
};

export default function TicketsPage() {
  return <TicketsDataTable />;
}

