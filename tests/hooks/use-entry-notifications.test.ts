import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { mockChannel, mockRemoveChannel, mockToastInfo, mockChannelObj, callbacks } = vi.hoisted(() => {
  const callbacks: {
    onPayload: ((payload: any) => void) | null;
    onStatus: ((status: string, err?: any) => void) | null;
  } = { onPayload: null, onStatus: null };

  const mockChannelObj = {
    on: vi.fn((_event: string, _filter: any, callback: (payload: any) => void) => {
      callbacks.onPayload = callback;
      return mockChannelObj;
    }),
    subscribe: vi.fn((callback?: (status: string, err?: any) => void) => {
      if (callback) callbacks.onStatus = callback;
      return mockChannelObj;
    }),
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
  useEntitiesStore: {
    getState: () => ({ triggerEntitiesUpdate: vi.fn() }),
  },
}));

import { useNotificationStore } from "@/lib/store/notifications";
import { useEntryNotifications } from "@/hooks/use-entry-notifications";

describe("useEntryNotifications", () => {
  let fetchMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationStore.getState().clearAll();
    currentUser = mockUser;
    callbacks.onPayload = null;
    callbacks.onStatus = null;

    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        notifications: [
          {
            id: "entry-100",
            entryId: 100,
            title: "Historical Entry",
            vehicleNumber: "KA01AB1111",
            weight: 30000,
            centerName: "Center #1",
            createdAt: "2026-11-18T08:00:00Z",
            read: true,
          },
        ],
        unreadCount: 0,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("waits for SUBSCRIBED before firing catchup GET, and buffers in-flight events", async () => {
    renderHook(() => useEntryNotifications());

    // 1. Channel initiated but status NOT yet SUBSCRIBED
    expect(mockChannelObj.subscribe).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    // 2. An event arrives while connection is establishing
    expect(callbacks.onPayload).toBeDefined();
    callbacks.onPayload!({
      new: {
        id: 200,
        vehicle_number: "KA05MK9999",
        weight: 18500,
        center_id: 2,
        created_at: "2026-11-18T10:00:00Z",
      },
    });

    // 3. Socket status reaches SUBSCRIBED
    await act(async () => {
      callbacks.onStatus!("SUBSCRIBED");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/notifications");

    // 4. Store contains both historical and buffered entries, merged and sorted
    const storeState = useNotificationStore.getState();
    expect(storeState.notifications).toHaveLength(2);
    expect(storeState.notifications[0].id).toBe("entry-200"); // newest first
    expect(storeState.notifications[1].id).toBe("entry-100");
  });

  it("does not subscribe if user is not authenticated", () => {
    currentUser = null;
    renderHook(() => useEntryNotifications());

    expect(mockChannel).not.toHaveBeenCalled();
  });
});
