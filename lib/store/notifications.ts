import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface EntryNotification {
  id: string;
  entryId: number;
  title: string;
  vehicleNumber: string;
  weight: number;
  centerName: string;
  createdAt: string;
  read: boolean;
}

export const DEFAULT_CUSTOMER_NOTIFICATIONS: EntryNotification[] = [
  {
    id: "notif-cust-1",
    entryId: 1,
    title: "Gross Weight Recorded",
    vehicleNumber: "KA01EA1024",
    weight: 42500,
    centerName: "North Automatic Scale",
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    read: false,
  },
  {
    id: "notif-cust-2",
    entryId: 23,
    title: "Gross Weight Recorded",
    vehicleNumber: "MH04AB1212",
    weight: 41900,
    centerName: "North Automatic Scale",
    createdAt: new Date(Date.now() - 85 * 60 * 1000).toISOString(),
    read: false,
  },
  {
    id: "notif-cust-3",
    entryId: 18,
    title: "Tare Weight Recorded",
    vehicleNumber: "WB02MM1122",
    weight: 13900,
    centerName: "Main Weighbridge",
    createdAt: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
    read: true,
  },
];

interface NotificationState {
  notifications: EntryNotification[];
  unreadCount: number;
  setNotifications: (items: EntryNotification[], totalUnread?: number) => void;
  addNotification: (item: Omit<EntryNotification, "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  loadCustomerMockData: () => void;
}

export function sortNotifications(items: EntryNotification[]): EntryNotification[] {
  return [...items].sort((a, b) => {
    const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  });
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: DEFAULT_CUSTOMER_NOTIFICATIONS,
      unreadCount: DEFAULT_CUSTOMER_NOTIFICATIONS.filter((n) => !n.read).length,
      setNotifications: (items, totalUnread) => {
        const sorted = sortNotifications(items).slice(0, 100);
        set({
          notifications: sorted,
          unreadCount:
            totalUnread !== undefined ? totalUnread : sorted.filter((n) => !n.read).length,
        });
      },
      addNotification: (item) =>
        set((state) => {
          if (state.notifications.some((n) => n.id === item.id)) return state;
          const merged = [{ ...item, read: false }, ...state.notifications];
          const sorted = sortNotifications(merged).slice(0, 100);
          return { notifications: sorted, unreadCount: state.unreadCount + 1 };
        }),
      markAsRead: (id) =>
        set((state) => {
          const updated = state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
          const unread = updated.filter((n) => !n.read).length;
          return { notifications: updated, unreadCount: unread };
        }),
      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),
      clearAll: () => set({ notifications: [], unreadCount: 0 }),
      loadCustomerMockData: () =>
        set({
          notifications: DEFAULT_CUSTOMER_NOTIFICATIONS,
          unreadCount: DEFAULT_CUSTOMER_NOTIFICATIONS.filter((n) => !n.read).length,
        }),
    }),
    { name: "gluvok-notifications" },
  ),
);
