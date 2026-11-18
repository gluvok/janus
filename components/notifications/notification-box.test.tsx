import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Mock next/link to render simple anchor
vi.mock("next/link", () => ({
  default: ({ children, href, onClick, className }: any) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

import { useNotificationStore } from "@/lib/store/notifications";
import { NotificationBox } from "./notification-box";

describe("NotificationBox Component", () => {
  beforeEach(() => {
    useNotificationStore.getState().clearAll();
  });

  it("renders notification bell with 0 unread badge hidden", () => {
    render(<NotificationBox />);
    const button = screen.getByRole("button", { name: /notifications/i });
    expect(button).toBeDefined();
    expect(screen.queryByText(/new/i)).toBeNull();
  });

  it("renders badge when unread notifications exist", () => {
    useNotificationStore.getState().addNotification({
      id: "entry-1",
      entryId: 1,
      title: "New Vehicle Entry",
      vehicleNumber: "MH12AB1234",
      weight: 12000,
      centerName: "Center #1",
      createdAt: new Date().toISOString(),
    });

    render(<NotificationBox />);
    const badge = screen.getByText("1");
    expect(badge).toBeDefined();
  });

  it("displays 99+ when unread notifications exceed 99", () => {
    for (let i = 1; i <= 100; i++) {
      useNotificationStore.getState().addNotification({
        id: `entry-${i}`,
        entryId: i,
        title: "New Vehicle Entry",
        vehicleNumber: `MH12AB${i}`,
        weight: 10000,
        centerName: "Center #1",
        createdAt: new Date().toISOString(),
      });
    }

    render(<NotificationBox />);
    const badge = screen.getByText("99+");
    expect(badge).toBeDefined();
  });

  it("shows empty state when no notifications exist in popover", () => {
    render(<NotificationBox />);
    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    expect(screen.getByText("No entries received yet")).toBeDefined();
  });

  it("marks all notifications as read when Mark read is clicked", () => {
    useNotificationStore.getState().addNotification({
      id: "entry-1",
      entryId: 1,
      title: "New Vehicle Entry",
      vehicleNumber: "KA01CD5678",
      weight: 15000,
      centerName: "Center #1",
      createdAt: new Date().toISOString(),
    });

    render(<NotificationBox />);
    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    const markAllBtn = screen.getByRole("button", { name: /mark read/i });
    fireEvent.click(markAllBtn);

    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it("clears all notifications when Clear all is clicked", () => {
    useNotificationStore.getState().addNotification({
      id: "entry-1",
      entryId: 1,
      title: "New Vehicle Entry",
      vehicleNumber: "KA01CD5678",
      weight: 15000,
      centerName: "Center #1",
      createdAt: new Date().toISOString(),
    });

    render(<NotificationBox />);
    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    const clearAllBtn = screen.getByRole("button", { name: /clear all/i });
    fireEvent.click(clearAllBtn);

    expect(useNotificationStore.getState().notifications.length).toBe(0);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(screen.getByText("No entries received yet")).toBeDefined();
  });
});
