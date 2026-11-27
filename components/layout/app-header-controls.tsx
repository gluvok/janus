"use client";

import { NotificationBell } from "@/components/notification-bell";

export function AppHeaderControls() {
  return (
    <div className="flex items-center gap-2">
      <NotificationBell />
    </div>
  );
}
