import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  createEntry,
  validateCenterBelongsToFactory,
  validateCustomerBelongsToFactory,
  deleteEntries,
} from "./entries";
import { EntryStatus, EntrySource } from "@/lib/constants/enums";
import { ApiErrorMessage } from "@/lib/constants/messages";
import type { supabase } from "@/db";

type MockSupabaseClient = typeof supabase & {
  from: Mock;
  rpc: Mock;
};

const { mockUploadImages } = vi.hoisted(() => ({
  mockUploadImages: vi.fn(),
}));

vi.mock("./storage", () => ({
  uploadBase64ImagesToStorage: mockUploadImages,
}));

describe("Entries Service", () => {
  let mockClient: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadImages.mockResolvedValue(["http://img1.jpg"]);

    mockClient = {
      from: vi.fn(),
      rpc: vi.fn(),
    } as unknown as MockSupabaseClient;
  });

  describe("validateCenterBelongsToFactory", () => {
    it("passes when center exists in factory", async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 1, auto_approve: false },
          error: null,
        }),
      });

      const res = await validateCenterBelongsToFactory(mockClient, 1, 10);
      expect(res).toEqual({ id: 1, auto_approve: false });
    });

    it("throws SELECTED_CENTER_NOT_FOUND when center is missing", async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      await expect(validateCenterBelongsToFactory(mockClient, 1, 10)).rejects.toThrow(
        ApiErrorMessage.SELECTED_CENTER_NOT_FOUND,
      );
    });
  });

  describe("validateCustomerBelongsToFactory", () => {
    it("passes when customer exists in factory", async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 2 }, error: null }),
      });

      await expect(validateCustomerBelongsToFactory(mockClient, 2, 10)).resolves.toBeUndefined();
    });

    it("throws CUSTOMER_NOT_FOUND when customer is missing", async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      await expect(validateCustomerBelongsToFactory(mockClient, 2, 10)).rejects.toThrow(
        ApiErrorMessage.CUSTOMER_NOT_FOUND,
      );
    });
  });

  describe("createEntry", () => {
    const entryRow = {
      id: 100,
      vehicle_number: "MH12AB1234",
      weight: 12000,
      center_id: 1,
      created_by: 5,
      status: EntryStatus.PENDING,
      images: ["http://img1.jpg"],
    };
    const baseParams = {
      factoryId: 10,
      userId: 5,
      vehicleNumber: "MH12AB1234",
      weight: 12000,
      centerId: 1,
    };
    const rpcResult = (overrides: { replayed?: boolean; source?: EntrySource } = {}) => ({
      data: {
        entry: entryRow,
        weighment: null,
        replayed: false,
        source: EntrySource.MANUAL,
        ...overrides,
      },
      error: null,
    });

    it("maps params onto the create_entry_with_weighment rpc and returns entry with source and replayed", async () => {
      mockClient.rpc.mockResolvedValue(rpcResult({ source: EntrySource.DEVICE }));

      const res = await createEntry(mockClient, {
        factoryId: 10,
        deviceId: 3,
        vehicleNumber: "MH12AB1234",
        detectedVehicleNumber: "MH12AB1234",
        weight: 15000,
        centerId: 1,
        customerId: 2,
        status: EntryStatus.APPROVED,
        approvedBy: 7,
        images: ["data:image/jpeg;base64,..."],
      });

      expect(res).toEqual({ ...entryRow, source: EntrySource.DEVICE, replayed: false });
      expect(mockUploadImages).toHaveBeenCalledWith(["data:image/jpeg;base64,..."], 10);
      expect(mockClient.rpc).toHaveBeenCalledWith("create_entry_with_weighment", {
        p_factory_id: 10,
        p_center_id: 1,
        p_created_by: 3,
        p_vehicle_number: "MH12AB1234",
        p_weight: 15000,
        p_detected_vehicle_number: "MH12AB1234",
        p_customer_id: 2,
        p_status: EntryStatus.APPROVED,
        p_approved_by: 7,
        p_images: ["http://img1.jpg"],
        p_idempotency_key: null,
      });
    });

    it("forwards idempotencyKey and returns replayed true when the rpc replays", async () => {
      const key = "3f2b8c1e-6d4a-4b7e-9a1c-2d5e8f0a1b3c";
      mockClient.rpc.mockResolvedValue(rpcResult({ replayed: true }));

      const res = await createEntry(mockClient, { ...baseParams, idempotencyKey: key });

      expect(res).toEqual({ ...entryRow, source: EntrySource.MANUAL, replayed: true });
      expect(mockClient.rpc).toHaveBeenCalledWith(
        "create_entry_with_weighment",
        expect.objectContaining({ p_idempotency_key: key }),
      );
    });

    it("rethrows rpc validation errors (P0001) with their message", async () => {
      mockClient.rpc.mockResolvedValue({
        data: null,
        error: { code: "P0001", message: ApiErrorMessage.SELECTED_CENTER_NOT_FOUND },
      });

      await expect(createEntry(mockClient, baseParams)).rejects.toThrow(
        new Error(ApiErrorMessage.SELECTED_CENTER_NOT_FOUND),
      );
    });

    it("hides unexpected rpc errors behind CREATE_ENTRY_FAILED", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      mockClient.rpc.mockResolvedValue({
        data: null,
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      });

      await expect(createEntry(mockClient, baseParams)).rejects.toThrow(
        new Error(ApiErrorMessage.CREATE_ENTRY_FAILED),
      );
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("throws CREATE_ENTRY_FAILED when the rpc returns no entry", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      mockClient.rpc.mockResolvedValue({ data: null, error: null });

      await expect(createEntry(mockClient, baseParams)).rejects.toThrow(
        new Error(ApiErrorMessage.CREATE_ENTRY_FAILED),
      );
      consoleError.mockRestore();
    });

    it("throws when no creator id is provided and does not call the rpc", async () => {
      await expect(
        createEntry(mockClient, {
          factoryId: 10,
          vehicleNumber: "MH12AB1234",
          weight: 12000,
          centerId: 1,
        }),
      ).rejects.toThrow("Missing created_by user ID");
      expect(mockClient.rpc).not.toHaveBeenCalled();
    });
  });

  describe("deleteEntries", () => {
    it("throws error when single entry is linked to an active weighment", async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn(() => ({
          or: vi.fn(() => ({
            is: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: [{ id: 10 }],
                error: null,
              }),
            })),
          })),
        })),
      });

      await expect(deleteEntries(mockClient, 1, [5])).rejects.toThrow(
        ApiErrorMessage.CANNOT_DELETE_ENTRY(5),
      );
    });

    it("throws error when multiple entries have active linked weighments", async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn(() => ({
          or: vi.fn(() => ({
            is: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: [{ id: 10 }],
                error: null,
              }),
            })),
          })),
        })),
      });

      await expect(deleteEntries(mockClient, 1, [5, 6])).rejects.toThrow(
        ApiErrorMessage.CANNOT_DELETE_SELECTED_ENTRIES,
      );
    });

    it("soft deletes unlinked entries successfully", async () => {
      mockClient.from.mockImplementation((table: string) => {
        if (table === "weighments") {
          return {
            select: vi.fn(() => ({
              or: vi.fn(() => ({
                is: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                })),
              })),
            })),
          };
        }
        if (table === "entries") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn().mockResolvedValue({
                    data: [{ id: 5 }, { id: 6 }],
                    error: null,
                  }),
                })),
              })),
            })),
            update: vi.fn(() => ({
              in: vi.fn(() => ({
                is: vi.fn(() => ({
                  select: vi.fn().mockResolvedValue({
                    data: [{ id: 5 }, { id: 6 }],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await deleteEntries(mockClient, 1, [5, 6]);
      expect(result.deletedIds).toEqual([5, 6]);
    });

    it("returns empty array when entryIds is empty", async () => {
      const result = await deleteEntries(mockClient, 1, []);
      expect(result.deletedIds).toEqual([]);
    });
  });
});
