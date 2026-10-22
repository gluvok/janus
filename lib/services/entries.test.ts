import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  createEntry,
  validateCenterBelongsToFactory,
  validateCustomerBelongsToFactory,
  deleteEntries,
} from "./entries";
import { EntryStatus, EntrySource, Role } from "@/lib/constants/enums";
import { ApiErrorMessage } from "@/lib/constants/messages";
import type { supabase } from "@/db";

type MockSupabaseClient = typeof supabase & {
  from: Mock;
};

const { mockUploadImages, mockValidateSeq, mockTryMerge } = vi.hoisted(() => ({
  mockUploadImages: vi.fn(),
  mockValidateSeq: vi.fn(),
  mockTryMerge: vi.fn(),
}));

vi.mock("./storage", () => ({
  uploadBase64ImagesToStorage: mockUploadImages,
}));

vi.mock("./weighments", () => ({
  validateSequentialApproval: mockValidateSeq,
  tryMergeEntries: mockTryMerge,
}));

describe("Entries Service", () => {
  let mockClient: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadImages.mockResolvedValue(["http://img1.jpg"]);
    mockValidateSeq.mockResolvedValue(undefined);
    mockTryMerge.mockResolvedValue(null);

    mockClient = {
      from: vi.fn(),
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
    it("creates a manual entry with default pending status and customer", async () => {
      const insertedEntry = {
        id: 100,
        vehicle_number: "MH12AB1234",
        weight: 12000,
        center_id: 1,
        created_by: 5,
        approved_by: null,
        customer_id: 2,
        factory_id: 10,
        status: EntryStatus.PENDING,
        auto_approved: false,
        images: ["http://img1.jpg"],
      };

      mockClient.from.mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 5, role: Role.OPERATOR },
              error: null,
            }),
          };
        }
        if (table === "centers") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 1, auto_approve: false },
              error: null,
            }),
          };
        }
        if (table === "customers") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 2 }, error: null }),
          };
        }
        if (table === "entries") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: insertedEntry, error: null }),
              }),
            }),
          };
        }
      });

      const res = await createEntry(mockClient, {
        factoryId: 10,
        userId: 5,
        vehicleNumber: "MH12AB1234",
        weight: 12000,
        centerId: 1,
        customerId: 2,
        images: ["data:image/jpeg;base64,..."],
      });

      expect(res).toEqual({ ...insertedEntry, source: EntrySource.MANUAL });
      expect(mockUploadImages).toHaveBeenCalledWith(["data:image/jpeg;base64,..."], 10);
      expect(mockValidateSeq).not.toHaveBeenCalled();
      expect(mockTryMerge).not.toHaveBeenCalled();
    });

    it("creates a device entry with approved status and runs sequential approval and merge", async () => {
      const insertedEntry = {
        id: 101,
        detected_vehicle_number: "MH12AB1234",
        vehicle_number: "MH12AB1234",
        weight: 15000,
        center_id: 1,
        created_by: 3,
        approved_by: 3,
        customer_id: null,
        factory_id: 10,
        status: EntryStatus.APPROVED,
        auto_approved: true,
        images: ["http://img1.jpg"],
      };

      mockClient.from.mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 3, role: Role.HARDWARE },
              error: null,
            }),
          };
        }
        if (table === "centers") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 1, auto_approve: true },
              error: null,
            }),
          };
        }
        if (table === "entries") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: insertedEntry, error: null }),
              }),
            }),
          };
        }
      });

      const res = await createEntry(mockClient, {
        factoryId: 10,
        deviceId: 3,
        vehicleNumber: "MH12AB1234",
        detectedVehicleNumber: "MH12AB1234",
        weight: 15000,
        centerId: 1,
        status: EntryStatus.APPROVED,
      });

      expect(res).toEqual({ ...insertedEntry, source: EntrySource.DEVICE });
      expect(mockValidateSeq).toHaveBeenCalledWith(
        mockClient,
        1,
        "MH12AB1234",
        expect.any(String),
        0,
        true,
        10,
      );
      expect(mockTryMerge).toHaveBeenCalledWith(
        mockClient,
        10,
        101,
        expect.objectContaining({ id: 101 }),
      );
    });

    it("creates a device entry with NO_PLATE_DETECTED without querying centers table", async () => {
      const insertedEntry = {
        id: 102,
        detected_vehicle_number: "NO_PLATE_DETECTED",
        vehicle_number: "NO_PLATE_DETECTED",
        weight: 15000,
        center_id: 1,
        created_by: 3,
        approved_by: null,
        customer_id: null,
        factory_id: 10,
        status: EntryStatus.PENDING,
        auto_approved: false,
        images: ["http://img1.jpg"],
      };

      const centersQueryMock = vi.fn();
      mockClient.from.mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 3, role: Role.HARDWARE },
              error: null,
            }),
          };
        }
        if (table === "centers") {
          centersQueryMock();
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 1, auto_approve: true },
              error: null,
            }),
          };
        }
        if (table === "entries") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: insertedEntry, error: null }),
              }),
            }),
          };
        }
      });

      const res = await createEntry(mockClient, {
        factoryId: 10,
        deviceId: 3,
        vehicleNumber: "NO_PLATE_DETECTED",
        detectedVehicleNumber: "NO_PLATE_DETECTED",
        weight: 15000,
        centerId: 1,
      });

      expect(res).toEqual({ ...insertedEntry, source: EntrySource.DEVICE });
      expect(centersQueryMock).not.toHaveBeenCalled();
      expect(mockValidateSeq).not.toHaveBeenCalled();
      expect(mockTryMerge).not.toHaveBeenCalled();
    });

    it("throws error when db insert fails", async () => {
      mockClient.from.mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 5, role: Role.OPERATOR },
              error: null,
            }),
          };
        }
        if (table === "centers") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 1, auto_approve: false },
              error: null,
            }),
          };
        }
        if (table === "entries") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: "DB failure" },
                }),
              }),
            }),
          };
        }
      });

      await expect(
        createEntry(mockClient, {
          factoryId: 10,
          userId: 5,
          vehicleNumber: "MH12AB1234",
          weight: 12000,
          centerId: 1,
        }),
      ).rejects.toThrow(ApiErrorMessage.CREATE_ENTRY_FAILED);
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
