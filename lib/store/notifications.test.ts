import { describe, it, expect, beforeEach } from "vitest";
import { useNotificationStore } from "./notifications";

describe("Notification Store", () => {
  beforeEach(() => {
    useNotificationStore.getState().clearAll();
  });

  it("adds notification, increments unreadCount, and marks read", () => {
    useNotificationStore.getState().addNotification({
      id: "entry-101",
      entryId: 101,
      title: "New Weighment Entry",
      vehicleNumber: "RJ09GA0165",
      weight: 14200,
      centerName: "North Yard",
      createdAt: new Date().toISOString(),
    });

    expect(useNotificationStore.getState().unreadCount).toBe(1);
    expect(useNotificationStore.getState().notifications.length).toBe(1);
    expect(useNotificationStore.getState().notifications[0].read).toBe(false);

    useNotificationStore.getState().markAsRead("entry-101");
    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
  });

  it("deduplicates notifications by ID", () => {
    const item = {
      id: "entry-101",
      entryId: 101,
      title: "New Weighment Entry",
      vehicleNumber: "RJ09GA0165",
      weight: 14200,
      centerName: "North Yard",
      createdAt: new Date().toISOString(),
    };

    useNotificationStore.getState().addNotification(item);
    useNotificationStore.getState().addNotification(item);

    expect(useNotificationStore.getState().notifications.length).toBe(1);
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it("marks all notifications as read", () => {
    useNotificationStore.getState().addNotification({
      id: "entry-1",
      entryId: 1,
      title: "Entry 1",
      vehicleNumber: "MH01AB1111",
      weight: 10000,
      centerName: "Center 1",
      createdAt: new Date().toISOString(),
    });
    useNotificationStore.getState().addNotification({
      id: "entry-2",
      entryId: 2,
      title: "Entry 2",
      vehicleNumber: "MH01AB2222",
      weight: 20000,
      centerName: "Center 2",
      createdAt: new Date().toISOString(),
    });

    expect(useNotificationStore.getState().unreadCount).toBe(2);

    useNotificationStore.getState().markAllAsRead();
    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(useNotificationStore.getState().notifications.every((n) => n.read)).toBe(true);
  });

  it("clears all notifications", () => {
    useNotificationStore.getState().addNotification({
      id: "entry-1",
      entryId: 1,
      title: "Entry 1",
      vehicleNumber: "MH01AB1111",
      weight: 10000,
      centerName: "Center 1",
      createdAt: new Date().toISOString(),
    });

    useNotificationStore.getState().clearAll();
    expect(useNotificationStore.getState().notifications.length).toBe(0);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it("hydrates and sorts notifications using setNotifications", () => {
    const items = [
      {
        id: "entry-1",
        entryId: 1,
        title: "Older Entry",
        vehicleNumber: "KA01AB1111",
        weight: 15000,
        centerName: "Center 1",
        createdAt: "2026-11-18T08:00:00Z",
        read: true,
      },
      {
        id: "entry-2",
        entryId: 2,
        title: "Newer Entry",
        vehicleNumber: "KA01AB2222",
        weight: 25000,
        centerName: "Center 1",
        createdAt: "2026-11-18T09:00:00Z",
        read: false,
      },
    ];

    useNotificationStore.getState().setNotifications(items);
    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(2);
    expect(state.notifications[0].id).toBe("entry-2"); // newer first
    expect(state.unreadCount).toBe(1);
  });

  it("loads default customer mock notifications", () => {
    useNotificationStore.getState().loadCustomerMockData();
    const state = useNotificationStore.getState();
    expect(state.notifications.length).toBe(3);
    expect(state.unreadCount).toBe(2);
    expect(state.notifications[0].vehicleNumber).toBe("KA01EA1024");
    expect(state.notifications[1].vehicleNumber).toBe("MH04AB1212");
  });
});
