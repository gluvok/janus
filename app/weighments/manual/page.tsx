import type { Metadata } from "next";
import { WeighmentsTableContainer } from "../data-table";

export const metadata: Metadata = {
  title: "Manual Weighments | Mesto",
  description: "View and manage manual weighment cycles and net weight measurements.",
};

export default function ManualWeighmentsPage() {
  return <WeighmentsTableContainer mode="manual" />;
}
