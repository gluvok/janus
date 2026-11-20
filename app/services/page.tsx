import type { Metadata } from "next";
import { UnderConstruction } from "@/components/under-construction";
import { appIcons } from "@/lib/icons";

export const metadata: Metadata = {
  title: "Services | Mesto",
  description: "System services and external integrations.",
};

export default function ServicesPage() {
  return (
    <UnderConstruction
      title="System Services"
      description="System services and external integration modules are currently in active development. Please verify back shortly as features are rolled out."
      icon={appIcons.services}
    />
  );
}
