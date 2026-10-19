import type { Metadata } from "next";
import { WeighmentsDataTable } from "./data-table";

export const metadata: Metadata = {
  title: "Weighments | Mesto",
  description: "View and manage completed weighment cycles and net weight measurements.",
};

export default function WeighmentsPage() {
  return <WeighmentsDataTable />;
}
