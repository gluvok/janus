import type { Metadata } from "next";
import { CustomersDataTable } from "./customers-data-table";

export const metadata: Metadata = {
  title: "Customers | Mesto",
  description: "Manage transport and weighbridge customer profiles.",
};

export default function CustomersPage() {
  return <CustomersDataTable />;
}
