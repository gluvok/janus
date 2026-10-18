import type { Metadata } from "next";
import { CentersDataTable } from "./data-table";

export const metadata: Metadata = {
  title: "Centers | Mesto",
  description: "Manage processing facilities and operational locations.",
};

export default function CentersPage() {
  return <CentersDataTable />;
}
