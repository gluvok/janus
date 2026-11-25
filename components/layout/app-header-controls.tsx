"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Notification01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

export function AppHeaderControls() {
  return (
    <Button variant="ghost" size="icon-sm" aria-label="Notifications">
      <HugeiconsIcon icon={Notification01Icon} />
    </Button>
  );
}
