import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { mockChannel, mockRemoveChannel, mockToastInfo, mockChannelObj, callbacks } = vi.hoisted(() => {
  const callbacks: { onPayload: ((payload: any) => void) | null } = { onPayload: null };
  const mockChannelObj = {
    on: vi.fn((_event: string, _filter: any, callback: (payload: any) => void) => {
      callbacks.onPayload = callback;
      return mockChannelObj;
    }),
    subscribe: vi.fn(() => mockChannelObj),
  };
  return {
    mockChannel: vi.fn().mockReturnValue(mockChannelObj),
    mockRemoveChannel: vi.fn(),
    mockToastInfo: vi.fn(),
    mockChannelObj,
    callbacks,
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    info: mockToastInfo,
  },
}));

const mockUser = {
  id: "1",
  username: "operator",
  name: "Operator",
  role: "OPERATOR",
  factory_id: 1,
};

let currentUser: any = mockUser;

vi.mock("@/lib/store", () => ({
  useAuthStore: (selector: any) => selector({ user: currentUser }),
}));

import { useNotificationStore } from "@/lib/store/notifications";
import { useEntryNotifications } from "@/hooks/use-entry-notifications";

describe("useEntryNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationStore.getState().clearAll();
    currentUser = mockUser;
    callbacks.onPayload = null;
  });

  it("subscribes to realtime entries and processes incoming INSERT event", () => {
    const { unmount } = renderHook(() => useEntryNotifications());

    expect(mockChannel).toHaveBeenCalledWith("realtime-entries");
    expect(mockChannelObj.on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "entries",
      },
      expect.any(Function),
    );
    expect(mockChannelObj.subscribe).toHaveBeenCalled();

    // Simulate incoming realtime entry
    expect(callbacks.onPayload).toBeDefined();
    callbacks.onPayload!({
      new: {
        id: 205,
        vehicle_number: "KA05MK9999",
        weight: 18500,
        center_id: 2,
        created_at: "2026-11-18T10:00:00Z",
      },
    });

    const storeState = useNotificationStore.getState();
    expect(storeState.unreadCount).toBe(1);
    expect(storeState.notifications[0]).toEqual({
      id: "entry-205",
      entryId: 205,
      title: "New Vehicle Entry",
      vehicleNumber: "KA05MK9999",
      weight: 18500,
      centerName: "Center #2",
      createdAt: "2026-11-18T10:00:00Z",
      read: false,
    });

    expect(mockToastInfo).toHaveBeenCalledWith(
      "New Weighment Entry: KA05MK9999",
      expect.objectContaining({
        description: expect.stringContaining("18,500 kg"),
      }),
    );

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannelObj);
  });

  it("does not subscribe if user is not authenticated", () => {
    currentUser = null;
    renderHook(() => useEntryNotifications());
    expect(mockChannel).not.toHaveBeenCalled();
  });
});
