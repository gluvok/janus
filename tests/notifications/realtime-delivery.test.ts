import { describe, it, expect, beforeEach } from "vitest";
import { useNotificationStore } from "@/lib/store/notifications";

describe("Realtime Notification State Delivery", () => {
  beforeEach(() => {
    useNotificationStore.getState().clearAll();
  });

  it("receives entry event, updates unread badge and handles mark-read", () => {
    useNotificationStore.getState().addNotification({
      id: "entry-505",
      entryId: 505,
      title: "New Vehicle Entry",
      vehicleNumber: "HR26DK8333",
      weight: 28450,
      centerName: "Center #1",
      createdAt: new Date().toISOString(),
    });

    expect(useNotificationStore.getState().unreadCount).toBe(1);
    expect(useNotificationStore.getState().notifications.length).toBe(1);
    expect(useNotificationStore.getState().notifications[0].vehicleNumber).toBe("HR26DK8333");

    useNotificationStore.getState().markAllAsRead();
    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
  });

  it("prevents duplicate notifications with the same id", () => {
    const item = {
      id: "entry-505",
      entryId: 505,
      title: "New Vehicle Entry",
      vehicleNumber: "HR26DK8333",
      weight: 28450,
      centerName: "Center #1",
      createdAt: new Date().toISOString(),
    };

    useNotificationStore.getState().addNotification(item);
    useNotificationStore.getState().addNotification(item);

    expect(useNotificationStore.getState().notifications.length).toBe(1);
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });
});
