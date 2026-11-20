import type { Metadata } from "next";
import { UnderConstruction } from "@/components/under-construction";
import { appIcons } from "@/lib/icons";

export const metadata: Metadata = {
  title: "Support | Mesto",
  description: "Technical assistance and customer helpdesk.",
};

export default function SupportPage() {
  return (
    <UnderConstruction
      title="Support Center"
      description="The technical assistance and customer support portal is currently undergoing scheduled enhancements. Please check back soon or reach out via operational channels."
      icon={appIcons.support}
    />
  );
}
