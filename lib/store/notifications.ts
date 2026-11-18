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

interface NotificationState {
  notifications: EntryNotification[];
  unreadCount: number;
  addNotification: (item: Omit<EntryNotification, "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [],
      unreadCount: 0,
      addNotification: (item) =>
        set((state) => {
          if (state.notifications.some((n) => n.id === item.id)) return state;
          const updated = [{ ...item, read: false }, ...state.notifications].slice(0, 50);
          return { notifications: updated, unreadCount: state.unreadCount + 1 };
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
    }),
    { name: "gluvok-notifications" },
  ),
);
