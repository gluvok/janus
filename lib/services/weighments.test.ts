import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  validateSequentialApproval,
  tryMergeEntries,
  formatWeighmentRecord,
  deleteWeighments,
} from "./weighments";
import { EntryStatus, Role, Unit } from "@/lib/constants/enums";
import type { supabase } from "@/db";
import { createMockQueryBuilder } from "@/tests/test-utils";

type MockSupabaseClient = typeof supabase & {
  from: Mock;
};

describe("Weighments Service", () => {
  let mockClient: MockSupabaseClient;

  beforeEach(() => {
    mockClient = {
      from: vi.fn(),
    } as unknown as MockSupabaseClient;
  });

  describe("validateSequentialApproval", () => {
    it("should pass if no earlier pending entries exist for the vehicle in the same center", async () => {
      const query = createMockQueryBuilder({ maybeSingleData: null });
      mockClient.from.mockReturnValue(query);

      await expect(
        validateSequentialApproval(mockClient, 1, "MH12AB1234", "2026-08-09T14:00:00Z", 2, 1),
      ).resolves.toBeUndefined();

      expect(mockClient.from).toHaveBeenCalledWith("entries");
      expect(query.eq).toHaveBeenCalledWith("center_id", 1);
      expect(query.eq).toHaveBeenCalledWith("vehicle_number", "MH12AB1234");
      expect(query.eq).toHaveBeenCalledWith("status", EntryStatus.PENDING);
      expect(query.eq).toHaveBeenCalledWith("users.role", Role.HARDWARE);
    });

    it("should throw an error if an earlier pending entry exists for the vehicle in the same center", async () => {
      const query = createMockQueryBuilder({
        maybeSingleData: {
          id: 1,
          created_at: "2026-08-09T12:00:00Z",
          users: { role: Role.HARDWARE },
        },
      });
      mockClient.from.mockReturnValue(query);

      await expect(
        validateSequentialApproval(mockClient, 1, "MH12AB1234", "2026-08-09T14:00:00Z", 2, 1),
      ).rejects.toThrow(/Cannot approve entry #2 because earlier device entry #1/);
    });
  });

  describe("tryMergeEntries", () => {
    it("should merge two entries of the same source and vehicle into a weighment when check_center_on_merge is false", async () => {
      const e2Data = {
        id: 2,
        vehicle_number: "MH12AB1234",
        status: EntryStatus.APPROVED,
        created_by: 1,
        creator: { role: Role.HARDWARE },
        created_at: "2026-08-09T14:00:00Z",
        center_id: 10,
      };
      const e1Data = {
        id: 1,
        vehicle_number: "MH12AB1234",
        status: EntryStatus.APPROVED,
        created_by: 1,
        creator: { role: Role.HARDWARE },
        created_at: "2026-08-09T12:00:00Z",
        center_id: 20, // different center
      };

      let entriesCallCount = 0;
      const entriesQuery2 = createMockQueryBuilder({ data: [e1Data] });

      mockClient.from.mockImplementation((table: string) => {
        if (table === "factories") {
          return createMockQueryBuilder({
            maybeSingleData: { check_center_on_merge: false },
          });
        }
        if (table === "entries") {
          entriesCallCount++;
          if (entriesCallCount === 1) {
            return createMockQueryBuilder({ maybeSingleData: e2Data });
          }
          return entriesQuery2;
        }
        if (table === "weighments") {
          return createMockQueryBuilder({
            maybeSingleData: null,
            singleData: {
              id: 100,
              in_entry_id: 1,
              out_entry_id: 2,
              unit: Unit.KG,
            },
          });
        }
      });

      const res = await tryMergeEntries(mockClient, 1, 2);
      expect(res).toEqual({
        id: 100,
        in_entry_id: 1,
        out_entry_id: 2,
        unit: Unit.KG,
      });
      // Should NOT filter by center_id when check_center_on_merge is false
      expect(entriesQuery2.eq).not.toHaveBeenCalledWith("center_id", 10);
    });

    it("should filter by center_id when check_center_on_merge is true", async () => {
      const e2Data = {
        id: 2,
        vehicle_number: "MH12AB1234",
        status: EntryStatus.APPROVED,
        created_by: 1,
        creator: { role: Role.HARDWARE },
        created_at: "2026-08-09T14:00:00Z",
        center_id: 10,
      };
      const e1Data = {
        id: 1,
        vehicle_number: "MH12AB1234",
        status: EntryStatus.APPROVED,
        created_by: 1,
        creator: { role: Role.HARDWARE },
        created_at: "2026-08-09T12:00:00Z",
        center_id: 10, // matching center
      };

      let entriesCallCount = 0;
      const entriesQuery2 = createMockQueryBuilder({ data: [e1Data] });

      mockClient.from.mockImplementation((table: string) => {
        if (table === "factories") {
          return createMockQueryBuilder({
            maybeSingleData: { check_center_on_merge: true },
          });
        }
        if (table === "entries") {
          entriesCallCount++;
          if (entriesCallCount === 1) {
            return createMockQueryBuilder({ maybeSingleData: e2Data });
          }
          return entriesQuery2;
        }
        if (table === "weighments") {
          return createMockQueryBuilder({
            maybeSingleData: null,
            singleData: {
              id: 100,
              in_entry_id: 1,
              out_entry_id: 2,
              unit: Unit.KG,
            },
          });
        }
      });

      const res = await tryMergeEntries(mockClient, 1, 2);
      expect(res).toEqual({
        id: 100,
        in_entry_id: 1,
        out_entry_id: 2,
        unit: Unit.KG,
      });
      // Should filter by center_id when check_center_on_merge is true
      expect(entriesQuery2.eq).toHaveBeenCalledWith("center_id", 10);
    });

    it("should return null if no matching entry of the same source is found", async () => {
      const e2Data = {
        id: 2,
        vehicle_number: "MH12AB1234",
        status: EntryStatus.APPROVED,
        created_by: 2,
        creator: { role: Role.OPERATOR },
        created_at: "2026-08-09T14:00:00Z",
        center_id: 10,
      };

      let callCount = 0;
      mockClient.from.mockImplementation((table: string) => {
        if (table === "factories") {
          return createMockQueryBuilder({
            maybeSingleData: { check_center_on_merge: false },
          });
        }
        if (table === "entries") {
          callCount++;
          if (callCount === 1) {
            return createMockQueryBuilder({ maybeSingleData: e2Data });
          }
          return createMockQueryBuilder({ data: [] });
        }
        if (table === "weighments") {
          return createMockQueryBuilder({ maybeSingleData: null });
        }
      });

      const res = await tryMergeEntries(mockClient, 1, 2);
      expect(res).toBeNull();
    });

    it("should merge with a later unmerged entry (forward merge) when no earlier entry exists", async () => {
      const e1Data = {
        id: 1,
        vehicle_number: "MH12AB1234",
        status: EntryStatus.APPROVED,
        created_by: 1,
        creator: { role: Role.HARDWARE },
        created_at: "2026-08-09T10:00:00Z",
        center_id: 10,
      };
      const e2Data = {
        id: 2,
        vehicle_number: "MH12AB1234",
        status: EntryStatus.APPROVED,
        created_by: 1,
        creator: { role: Role.HARDWARE },
        created_at: "2026-08-09T12:00:00Z",
        center_id: 10,
      };

      let entriesCallCount = 0;
      mockClient.from.mockImplementation((table: string) => {
        if (table === "factories") {
          return createMockQueryBuilder({
            maybeSingleData: { check_center_on_merge: false },
          });
        }
        if (table === "entries") {
          entriesCallCount++;
          if (entriesCallCount === 1) {
            return createMockQueryBuilder({ maybeSingleData: e1Data });
          }
          if (entriesCallCount === 2) {
            return createMockQueryBuilder({ data: [] });
          }
          return createMockQueryBuilder({ data: [e2Data] });
        }
        if (table === "weighments") {
          return createMockQueryBuilder({
            maybeSingleData: null,
            singleData: {
              id: 101,
              in_entry_id: 1,
              out_entry_id: 2,
              unit: Unit.KG,
            },
          });
        }
      });

      const res = await tryMergeEntries(mockClient, 1, 1);
      expect(res).toEqual({
        id: 101,
        in_entry_id: 1,
        out_entry_id: 2,
        unit: Unit.KG,
      });
    });
  });

  describe("formatWeighmentRecord", () => {
    it("correctly formats weighment with rate_id, center, weights, and timestamps", () => {
      const mockRow = {
        id: 10,
        unit: Unit.KG,
        type: "unassigned",
        rate_id: 7,
        in_entry_id: 1,
        out_entry_id: 2,
        created_at: "2026-08-31T10:00:00Z",
        updated_at: "2026-08-31T10:00:00Z",
        in_entry: {
          created_at: "2026-08-31T08:00:00Z",
          weight: 40000,
          vehicle_number: "KA01AB1234",
          center_id: 1,
          centers: { name: "Center A" },
          user_id: 2,
          users: { name: "Operator 1" },
          customer_id: 3,
          customers: { name: "Customer 1" },
          images: ["img1.jpg"],
        },
        out_entry: {
          created_at: "2026-08-31T10:00:00Z",
          weight: 15000,
          vehicle_number: "KA01AB1234",
          center_id: 2,
          centers: { name: "Center B" },
          user_id: 4,
          users: { name: "Operator 2" },
          customer_id: 3,
          customers: { name: "Customer 1" },
          images: ["img2.jpg"],
        },
      };

      const result = formatWeighmentRecord(mockRow);
      expect(result).toEqual({
        id: 10,
        unit: Unit.KG,
        type: "unassigned",
        rate_id: 7,
        gross_weight: 40000,
        tare_weight: 15000,
        net_weight: 25000,
        images: ["img1.jpg", "img2.jpg"],
        in_entry_id: 1,
        in_entry_created_at: "2026-08-31T08:00:00Z",
        out_entry_id: 2,
        out_entry_created_at: "2026-08-31T10:00:00Z",
        in_center_id: 1,
        in_center_name: "Center A",
        out_center_id: 2,
        out_center_name: "Center B",
        in_user_id: 2,
        in_user_name: "Operator 1",
        out_user_id: 4,
        out_user_name: "Operator 2",
        in_customer_id: 3,
        in_customer_name: "Customer 1",
        out_customer_id: 3,
        out_customer_name: "Customer 1",
        vehicle_number: "KA01AB1234",
        created_at: "2026-08-31T10:00:00Z",
        updated_at: "2026-08-31T10:00:00Z",
      });
    });

    it("safely handles weighment when in_entry and out_entry are missing or null", () => {
      const mockRow = {
        id: 20,
        unit: Unit.KG,
        type: "unassigned",
        rate_id: null,
        in_entry_id: 1,
        out_entry_id: 2,
        created_at: "2026-08-31T10:00:00Z",
        updated_at: "2026-08-31T10:00:00Z",
        in_entry: null,
        out_entry: null,
      };

      const result = formatWeighmentRecord(mockRow);
      expect(result).toEqual({
        id: 20,
        unit: Unit.KG,
        type: "unassigned",
        rate_id: null,
        gross_weight: 0,
        tare_weight: 0,
        net_weight: 0,
        images: [],
        in_entry_id: 1,
        in_entry_created_at: undefined,
        out_entry_id: 2,
        out_entry_created_at: undefined,
        in_center_id: null,
        in_center_name: "",
        out_center_id: null,
        out_center_name: "",
        in_user_id: null,
        in_user_name: "",
        out_user_id: null,
        out_user_name: "",
        in_customer_id: null,
        in_customer_name: "",
        out_customer_id: null,
        out_customer_name: "",
        vehicle_number: "",
        created_at: "2026-08-31T10:00:00Z",
        updated_at: "2026-08-31T10:00:00Z",
      });
    });

    it("safely handles weighment when centers is missing on in_entry", () => {
      const mockRow = {
        id: 30,
        unit: Unit.KG,
        type: "unassigned",
        rate_id: null,
        in_entry_id: 1,
        out_entry_id: 2,
        created_at: "2026-08-31T10:00:00Z",
        updated_at: "2026-08-31T10:00:00Z",
        in_entry: {
          created_at: "2026-08-31T08:00:00Z",
          weight: 1000,
          vehicle_number: "KA01AB1234",
          center_id: 5,
          centers: null,
        },
        out_entry: {
          created_at: "2026-08-31T10:00:00Z",
          weight: 500,
          vehicle_number: "KA01AB1234",
          center_id: 6,
          centers: null,
        },
      };

      const result = formatWeighmentRecord(mockRow);
      expect(result.in_center_id).toBe(5);
      expect(result.in_center_name).toBe("");
      expect(result.out_center_id).toBe(6);
      expect(result.out_center_name).toBe("");
    });
  });

  describe("deleteWeighments", () => {
    it("should soft delete weighments and cascade soft delete to linked entries", async () => {
      const weighmentsData = [
        {
          id: 10,
          in_entry_id: 1,
          out_entry_id: 2,
          in_entry: { centers: { factory_id: 1 } },
        },
        {
          id: 20,
          in_entry_id: 3,
          out_entry_id: 4,
          in_entry: { centers: { factory_id: 1 } },
        },
      ];

      const weighmentsQuery = createMockQueryBuilder({ data: weighmentsData });
      const entriesQuery = createMockQueryBuilder();

      mockClient.from.mockImplementation((table: string) => {
        if (table === "weighments") return weighmentsQuery;
        if (table === "entries") return entriesQuery;
        return createMockQueryBuilder();
      });

      const result = await deleteWeighments(mockClient, 1, [10, 20]);
      expect(result.deletedIds).toEqual([10, 20]);
      expect(result.cascadedEntryIds).toEqual([1, 2, 3, 4]);
      expect(weighmentsQuery.update).toHaveBeenCalled();
      expect(entriesQuery.update).toHaveBeenCalled();
    });

    it("should return empty deletedIds when no matching weighments exist for factory", async () => {
      mockClient.from.mockReturnValue(createMockQueryBuilder({ data: [] }));

      const result = await deleteWeighments(mockClient, 1, [999]);
      expect(result.deletedIds).toEqual([]);
      expect(result.cascadedEntryIds).toEqual([]);
    });

    it("should return empty arrays when weighmentIds is empty", async () => {
      const result = await deleteWeighments(mockClient, 1, []);
      expect(result.deletedIds).toEqual([]);
      expect(result.cascadedEntryIds).toEqual([]);
    });
  });
});
