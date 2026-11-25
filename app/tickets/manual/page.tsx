import type { Metadata } from "next";
import { TicketsDataTable } from "../data-table";

export const metadata: Metadata = {
  title: "Manual Tickets | Mesto",
  description: "Manual support tickets and issue tracking.",
};

export default function ManualTicketsPage() {
  return <TicketsDataTable mode="manual" />;
}
