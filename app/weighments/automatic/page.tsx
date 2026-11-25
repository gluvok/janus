import type { Metadata } from "next";
import { WeighmentsTableContainer } from "../data-table";

export const metadata: Metadata = {
  title: "Automatic Weighments | Mesto",
  description: "View and manage automatic weighment cycles and net weight measurements.",
};

export default function AutomaticWeighmentsPage() {
  return <WeighmentsTableContainer mode="automatic" />;
}
