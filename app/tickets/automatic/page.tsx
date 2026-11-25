import type { Metadata } from "next";
import { TicketsDataTable } from "../data-table";

export const metadata: Metadata = {
  title: "Automatic Tickets | Mesto",
  description: "Automatic support tickets and issue tracking.",
};

export default function AutomaticTicketsPage() {
  return <TicketsDataTable mode="automatic" />;
}
