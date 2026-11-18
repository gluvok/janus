import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDispatchWebhook } = vi.hoisted(() => ({
  mockDispatchWebhook: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/services/webhooks", () => ({
  dispatchWebhook: mockDispatchWebhook,
}));

import { createEntry } from "@/lib/services/entries";

describe("createEntry with notifications and webhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes persistent notification and triggers async webhook on entry creation", async () => {
    const notifInsertMock = vi.fn().mockResolvedValue({ error: null });

    const mockClient: any = {
      from: vi.fn((table: string) => {
        if (table === "centers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1, name: "North Gate", auto_approve: false } }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "customers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 10 } }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1, role: "operator" } }),
                }),
              }),
            }),
          };
        }
        if (table === "entries") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 42,
                    factory_id: 1,
                    vehicle_number: "KA05MK8888",
                    weight: 32000,
                    status: "pending",
                    center_id: 1,
                    customer_id: 10,
                    created_at: "2026-11-18T12:00:00Z",
                  },
                }),
              }),
            }),
          };
        }
        if (table === "notifications") {
          return {
            insert: notifInsertMock,
          };
        }
        return {};
      }),
    };

    const entry = await createEntry(mockClient, {
      factoryId: 1,
      centerId: 1,
      vehicleNumber: "KA05MK8888",
      weight: 32000,
      createdBy: 1,
      customerId: 10,
    });

    expect(entry.id).toBe(42);
    expect(mockClient.from).toHaveBeenCalledWith("notifications");
    expect(notifInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        factory_id: 1,
        entry_id: 42,
        vehicle_number: "KA05MK8888",
        customer_id: 10,
      }),
    );
    expect(mockDispatchWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        factoryId: 1,
        event: "entry.created",
        payload: expect.objectContaining({
          id: 42,
          vehicle_number: "KA05MK8888",
        }),
      }),
    );
  });
});
