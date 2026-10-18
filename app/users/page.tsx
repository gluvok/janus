import type { Metadata } from "next";
import { UsersDataTable } from "./data-table";

export const metadata: Metadata = {
  title: "Users | Mesto",
  description: "Configure system operators, roles, and access credentials.",
};

export default function UsersPage() {
  return <UsersDataTable />;
}
