import { describe, it, expect, vi, beforeEach } from "vitest";
import * as webhookService from "@/lib/services/webhooks";
import { createEntry } from "@/lib/services/entries";
import { EntryStatus } from "@/lib/constants/enums";

describe("Entry Creation Webhook Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("triggers dispatchWebhook asynchronously when a new entry is created", async () => {
    const dispatchSpy = vi.spyOn(webhookService, "dispatchWebhook").mockResolvedValue({
      dispatched: true,
      status: 200,
    });

    const mockClient: any = {
      from: vi.fn((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1, role: "admin" } }),
                }),
              }),
            }),
          };
        }
        if (table === "centers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1, auto_approve: false } }),
                  }),
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
                    id: 501,
                    vehicle_number: "KA05MK8888",
                    weight: 32000,
                    center_id: 1,
                    status: EntryStatus.PENDING,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    };

    const entry = await createEntry(mockClient, {
      factoryId: 1,
      centerId: 1,
      vehicleNumber: "KA05MK8888",
      weight: 32000,
      createdBy: 1,
    });

    expect(entry.id).toBe(501);
    expect(dispatchSpy).toHaveBeenCalledWith(
      mockClient,
      1,
      "entry.created",
      expect.objectContaining({ id: 501, vehicle_number: "KA05MK8888" }),
    );
  });
});
