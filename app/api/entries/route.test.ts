import { describe, expect, it, vi, beforeEach } from "vitest";
import { PermissionKey, ProjectSlug, Role, EntryStatus, EntrySource } from "@/lib/constants/enums";
import { ApiErrorMessage } from "@/lib/constants/messages";

const {
  mockHasPermission,
  mockCreateEntry,
  mockVerifyDeviceRequest,
  mockUploadFilesToStorage,
  mockDeleteStorageImages,
  mockDb,
} = vi.hoisted(() => ({
  mockHasPermission: vi.fn(),
  mockCreateEntry: vi.fn(),
  mockVerifyDeviceRequest: vi.fn(),
  mockUploadFilesToStorage: vi.fn(),
  mockDeleteStorageImages: vi.fn(),
  mockDb: {
    from: vi.fn(),
  },
}));

vi.mock("@/db", () => ({
  db: mockDb,
  supabase: mockDb,
}));

vi.mock("@/lib/auth/device", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/device")>();
  return {
    ...actual,
    verifyDeviceRequest: mockVerifyDeviceRequest,
  };
});

vi.mock("@/lib/services/storage", () => ({
  uploadFilesToStorage: mockUploadFilesToStorage,
  deleteStorageImages: mockDeleteStorageImages,
}));

vi.mock("@/db/helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db/helpers")>();
  return {
    ...actual,
    withAuth: <T>(handler: T) => handler,
    hasPermission: mockHasPermission,
  };
});

vi.mock("@/lib/services/entries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/entries")>();
  return {
    ...actual,
    createEntry: mockCreateEntry,
  };
});

// Mock sharp-dependent image-processor to pass buffers through without actual cropping
vi.mock("@/lib/services/image-processor", () => ({
  preprocessCameraFiles: async (files: File[]) =>
    Promise.all(files.map((f) => f.arrayBuffer().then((ab) => Buffer.from(ab)))),
  DEFAULT_CAMERA_CROPS: [
    { camera: 1, top: 5, bottom: 34, left: 37, right: 28 },
    { camera: 2, top: 12, bottom: 31, left: 20, right: 49 },
  ],
}));

import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "./route";

type RawHandler = (
  request: NextRequest,
  user: {
    sub: string;
    username: string;
    role: Role;
    factory_id: number;
  },
  db: unknown,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;

const sampleUser = {
  sub: "1",
  username: "operator",
  role: Role.OPERATOR,
  factory_id: 1,
};

const context = { params: Promise.resolve({}) };

describe("Entries route handlers (/api/entries)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockReturnValue(true);
  });

  describe("GET /api/entries", () => {
    it("rejects when user lacks READ permission", async () => {
      mockHasPermission.mockReturnValue(false);
      const req = new NextRequest("http://localhost/api/entries");
      const handler = GET as unknown as RawHandler;
      const response = await handler(req, sampleUser, {}, context);

      expect(response.status).toBe(403);
      expect(mockHasPermission).toHaveBeenCalledWith(
        sampleUser,
        ProjectSlug.ENTRIES,
        PermissionKey.READ,
      );
    });

    it("returns formatted list of entries", async () => {
      const mockDb = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                order: vi.fn(() => ({
                  range: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: 1,
                        vehicle_number: "MH12AB1234",
                        created_by: 5,
                        centers: { name: "Main Center" },
                        users: { name: "Operator 1" },
                        customers: { name: "Customer A" },
                      },
                    ],
                    count: 1,
                    error: null,
                  }),
                })),
              })),
            })),
          })),
        })),
      };

      const req = new NextRequest("http://localhost/api/entries?page=1&limit=10");
      const handler = GET as unknown as RawHandler;
      const response = await handler(req, sampleUser, mockDb, context);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data[0].center_name).toBe("Main Center");
      expect(json.data[0].user_id).toBe(5);
      expect(json.data[0].user_name).toBe("Operator 1");
      expect(json.data[0].customer_name).toBe("Customer A");
      expect(json.pagination.total).toBe(1);
    });

    it("filters entries by auto_approved boolean flag", async () => {
      const eqMock = vi.fn();
      const mockQuery: Record<string, unknown> = {};
      mockQuery.select = vi.fn(() => mockQuery);
      mockQuery.eq = eqMock.mockImplementation(() => mockQuery);
      mockQuery.is = vi.fn(() => mockQuery);
      mockQuery.order = vi.fn(() => mockQuery);
      mockQuery.range = vi.fn().mockResolvedValue({
        data: [
          {
            id: 1,
            vehicle_number: "KA01AB2222",
            detected_vehicle_number: "KA01AB1111",
            status: EntryStatus.APPROVED,
            auto_approved: true,
          },
          {
            id: 2,
            vehicle_number: "KA01AB3333",
            detected_vehicle_number: "KA01AB3333",
            status: EntryStatus.APPROVED,
            auto_approved: true,
          },
        ],
        count: 2,
        error: null,
      });

      const mockDb = {
        from: vi.fn(() => mockQuery),
      };

      const req = new NextRequest(
        "http://localhost/api/entries?auto_approved=true&page=1&limit=10",
      );
      const handler = GET as unknown as RawHandler;
      const response = await handler(req, sampleUser, mockDb, context);

      expect(response.status).toBe(200);
      expect(eqMock).toHaveBeenCalledWith("auto_approved", true);
      const json = await response.json();
      expect(json.data).toHaveLength(2);
      expect(json.data[0]).not.toHaveProperty("edited");
    });

    it("scopes entries query with customers!inner and customers.user_id for Role.BASE users", async () => {
      const selectMock = vi.fn();
      const eqMock = vi.fn();
      const mockQuery: Record<string, unknown> = {};
      mockQuery.select = selectMock.mockImplementation(() => mockQuery);
      mockQuery.eq = eqMock.mockImplementation(() => mockQuery);
      mockQuery.is = vi.fn(() => mockQuery);
      mockQuery.order = vi.fn(() => mockQuery);
      mockQuery.range = vi.fn().mockResolvedValue({
        data: [{ id: 5, vehicle_number: "BASE123" }],
        count: 1,
        error: null,
      });

      const mockDb = {
        from: vi.fn(() => mockQuery),
      };

      const baseUser = {
        sub: "10",
        username: "cust_priya",
        role: Role.BASE,
        factory_id: 1,
      };

      const req = new NextRequest("http://localhost/api/entries?page=1&limit=10");
      const handler = GET as unknown as RawHandler;
      const response = await handler(req, baseUser, mockDb, context);

      expect(response.status).toBe(200);
      expect(selectMock).toHaveBeenCalledWith(
        "*, centers!inner(name, factory_id), created_by_user:users!created_by(name, role), approved_by_user:users!approved_by(name, role), customers!inner(name, user_id)",
        { count: "exact" },
      );
      expect(eqMock).toHaveBeenCalledWith("customers.user_id", 10);
    });
  });

  describe("POST /api/entries", () => {
    function createMultipartReq(
      fields: Record<string, string | number>,
      files?: File[],
      headers?: Record<string, string>,
    ) {
      const formData = new FormData();
      Object.entries(fields).forEach(([k, v]) => formData.append(k, String(v)));
      if (files) {
        files.forEach((f) => formData.append("files", f));
      }
      return new NextRequest("http://localhost/api/entries", {
        method: "POST",
        headers: {
          ...headers,
        },
        body: formData,
      });
    }

    it("rejects non-multipart requests with 415 Unsupported Media Type", async () => {
      const req = new NextRequest("http://localhost/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_number: "MH12AB1234",
          weight: 10000,
          center_id: 1,
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(415);
      const json = await response.json();
      expect(json.error).toBe("POST /api/entries requires multipart/form-data");
    });

    it("rejects when user lacks CREATE permission", async () => {
      mockHasPermission.mockReturnValue(false);
      const req = createMultipartReq({
        vehicle_number: "MH12AB1234",
        weight: 10000,
        center_id: 1,
      });

      const handler = POST as unknown as RawHandler;
      const response = await handler(req, sampleUser, {}, context);

      expect(response.status).toBe(403);
      expect(mockHasPermission).toHaveBeenCalledWith(
        sampleUser,
        ProjectSlug.ENTRIES,
        PermissionKey.CREATE,
      );
    });

    it("returns 400 for invalid body schema", async () => {
      const req = createMultipartReq({
        vehicle_number: "INVALID-PLATE",
        weight: -50,
      });

      const handler = POST as unknown as RawHandler;
      const response = await handler(req, sampleUser, {}, context);

      expect(response.status).toBe(400);
    });

    it("successfully creates entry via createEntry service and uploads attached files", async () => {
      const createdEntry = {
        id: 10,
        vehicle_number: "MH12AB1234",
        weight: 12000,
        center_id: 1,
        user_id: 1,
        factory_id: 1,
        source: EntrySource.MANUAL,
        status: EntryStatus.PENDING,
        images: ["https://storage.supabase.co/photo.jpg"],
      };
      mockCreateEntry.mockResolvedValue(createdEntry);
      mockUploadFilesToStorage.mockResolvedValue(["https://storage.supabase.co/photo.jpg"]);

      const maybeSingleFn = vi.fn().mockResolvedValue({ data: { id: 1, factory_id: 1 } });
      const innerIs = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
      const innerEq = vi.fn().mockReturnValue({ is: innerIs, maybeSingle: maybeSingleFn });
      const outerEq = vi.fn().mockReturnValue({ eq: innerEq, is: innerIs });
      mockDb.from.mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: outerEq }),
      });

      const file = new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: "image/jpeg" });
      const req = createMultipartReq(
        {
          vehicle_number: "MH12AB1234",
          weight: 12000,
          center_id: 1,
        },
        [file],
      );

      const handler = POST as unknown as RawHandler;
      const response = await handler(req, sampleUser, {}, context);

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data).toEqual(createdEntry);
      expect(mockUploadFilesToStorage).toHaveBeenCalledWith(
        [expect.objectContaining({ name: "cam1.jpg", type: "image/jpeg" })],
        1,
      );
      expect(mockCreateEntry).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          factoryId: 1,
          createdBy: 1,
          vehicleNumber: "MH12AB1234",
          weight: 12000,
          centerId: 1,
          status: EntryStatus.PENDING,
          images: ["https://storage.supabase.co/photo.jpg"],
        }),
      );
    });

    it("creates DEVICE entry when caller provides HTTP Basic Auth credentials", async () => {
      mockVerifyDeviceRequest.mockResolvedValue({
        success: true,
        device: { id: 5, factory_id: 1 },
      });

      mockDb.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 1, factory_id: 1 },
                }),
              }),
            }),
          }),
        }),
      });

      const createdEntry = {
        id: 20,
        detected_vehicle_number: "KA01AB1234",
        vehicle_number: "KA01AB1234",
        weight: 15000,
        center_id: 1,
        created_by: 5,
        approved_by: 5,
        factory_id: 1,
        source: EntrySource.DEVICE,
        status: EntryStatus.PENDING,
      };
      mockCreateEntry.mockResolvedValue(createdEntry);

      const basicHeader = `Basic ${Buffer.from("device1:pass123").toString("base64")}`;
      const req = createMultipartReq(
        {
          detected_vehicle_number: "KA01AB1234",
          weight: 15000,
          center_id: 1,
        },
        undefined,
        { authorization: basicHeader },
      );

      const response = await POST(req);

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.source).toBe(EntrySource.DEVICE);
      expect(mockCreateEntry).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          factoryId: 1,
          createdBy: 5,
          detectedVehicleNumber: "KA01AB1234",
          vehicleNumber: "KA01AB1234",
          weight: 15000,
          centerId: 1,
        }),
      );
    });

    it("creates DEVICE entry when caller provides credentials in FormData", async () => {
      mockVerifyDeviceRequest.mockResolvedValue({
        success: true,
        device: { id: 6, factory_id: 1 },
      });

      mockDb.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 2, factory_id: 1 },
                }),
              }),
            }),
          }),
        }),
      });

      const createdEntry = {
        id: 21,
        detected_vehicle_number: "MH04CD5678",
        vehicle_number: "MH04CD5678",
        weight: 18000,
        center_id: 2,
        created_by: 6,
        factory_id: 1,
        source: EntrySource.DEVICE,
        status: EntryStatus.PENDING,
      };
      mockCreateEntry.mockResolvedValue(createdEntry);

      const req = createMultipartReq({
        username: "device_scale_2",
        password: "hardware_secret",
        detected_vehicle_number: "MH04CD5678",
        weight: 18000,
        center_id: 2,
      });

      const response = await POST(req);

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.source).toBe(EntrySource.DEVICE);
    });

    it("creates DEVICE entry when device sends NO_PLATE_DETECTED", async () => {
      mockVerifyDeviceRequest.mockResolvedValue({
        success: true,
        device: { id: 5, factory_id: 1 },
      });

      mockDb.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 1, factory_id: 1 },
                }),
              }),
            }),
          }),
        }),
      });

      const createdEntry = {
        id: 21,
        detected_vehicle_number: "NO_PLATE_DETECTED",
        vehicle_number: "NO_PLATE_DETECTED",
        weight: 15000,
        center_id: 1,
        created_by: 5,
        approved_by: null,
        factory_id: 1,
        source: EntrySource.DEVICE,
        status: EntryStatus.PENDING,
      };
      mockCreateEntry.mockResolvedValue(createdEntry);

      const req = createMultipartReq({
        username: "device1",
        password: "secret",
        detected_vehicle_number: "NO_PLATE_DETECTED",
        weight: 15000,
        center_id: 1,
      });

      const response = await POST(req);

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.source).toBe(EntrySource.DEVICE);
      expect(mockCreateEntry).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          factoryId: 1,
          createdBy: 5,
          detectedVehicleNumber: "NO_PLATE_DETECTED",
          vehicleNumber: "NO_PLATE_DETECTED",
          weight: 15000,
          centerId: 1,
        }),
      );
    });

    it("rejects DEVICE entry when center is not found", async () => {
      mockVerifyDeviceRequest.mockResolvedValue({
        success: true,
        device: { id: 5, factory_id: 1 },
      });

      mockDb.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                }),
              }),
            }),
          }),
        }),
      });

      const req = createMultipartReq({
        username: "device1",
        password: "secret",
        detected_vehicle_number: "MH12AB1234",
        weight: 15000,
        center_id: 999,
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe(ApiErrorMessage.SELECTED_CENTER_NOT_FOUND);
    });

    it("rejects device request when verifyDeviceRequest fails", async () => {
      mockVerifyDeviceRequest.mockResolvedValue({
        success: false,
        status: 403,
        error: "Invalid device credentials",
      });

      const req = createMultipartReq(
        {
          detected_vehicle_number: "KA01AB1234",
          weight: 15000,
          center_id: 1,
        },
        undefined,
        { "x-username": "bad_user", "x-password": "bad_password" },
      );

      const response = await POST(req);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toBe("Invalid device credentials");
    });

    it("handles createEntry service error and performs compensating rollback", async () => {
      mockUploadFilesToStorage.mockResolvedValue(["https://storage.supabase.co/uploaded.jpg"]);
      mockCreateEntry.mockRejectedValue(new Error(ApiErrorMessage.SELECTED_CENTER_NOT_FOUND));

      const maybeSingle2 = vi.fn().mockResolvedValue({ data: { id: 999, factory_id: 1 } });
      const is2 = vi.fn().mockReturnValue({ maybeSingle: maybeSingle2 });
      const innerEq2 = vi.fn().mockReturnValue({ is: is2, maybeSingle: maybeSingle2 });
      const outerEq2 = vi.fn().mockReturnValue({ eq: innerEq2, is: is2 });
      mockDb.from.mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: outerEq2 }),
      });

      const file = new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: "image/jpeg" });
      const req = createMultipartReq(
        {
          vehicle_number: "MH12AB1234",
          weight: 12000,
          center_id: 999,
        },
        [file],
      );

      const handler = POST as unknown as RawHandler;
      const response = await handler(req, sampleUser, {}, context);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe(ApiErrorMessage.SELECTED_CENTER_NOT_FOUND);
      // Verify compensating rollback deleted the newly uploaded images from storage
      expect(mockDeleteStorageImages).toHaveBeenCalledWith(
        ["https://storage.supabase.co/uploaded.jpg"],
        1,
      );
    });
  });

  describe("DELETE /api/entries", () => {
    it("rejects when user lacks DELETE permission", async () => {
      mockHasPermission.mockReturnValue(false);
      const req = new NextRequest("http://localhost/api/entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [1, 2] }),
      });

      const handler = DELETE as unknown as RawHandler;
      const response = await handler(req, sampleUser, {}, context);

      expect(response.status).toBe(403);
      expect(mockHasPermission).toHaveBeenCalledWith(
        sampleUser,
        ProjectSlug.ENTRIES,
        PermissionKey.DELETE,
      );
    });

    it("rejects invalid ids payload", async () => {
      const req = new NextRequest("http://localhost/api/entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [] }),
      });

      const handler = DELETE as unknown as RawHandler;
      const response = await handler(req, sampleUser, {}, context);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe(ApiErrorMessage.PROVIDE_VALID_IDS);
    });

    it("rejects when entries are linked to active weighments", async () => {
      const mockDb = {
        from: vi.fn(() => ({
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
        })),
      };

      const req = new NextRequest("http://localhost/api/entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [1, 2] }),
      });

      const handler = DELETE as unknown as RawHandler;
      const response = await handler(req, sampleUser, mockDb, context);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe(ApiErrorMessage.CANNOT_DELETE_SELECTED_ENTRIES);
    });

    it("successfully deletes entries when unlinked", async () => {
      const mockDb = {
        from: vi.fn((table: string) => {
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
                      data: [{ id: 1 }, { id: 2 }],
                      error: null,
                    }),
                  })),
                })),
              })),
              update: vi.fn(() => ({
                in: vi.fn(() => ({
                  is: vi.fn(() => ({
                    select: vi.fn().mockResolvedValue({
                      data: [{ id: 1 }, { id: 2 }],
                      error: null,
                    }),
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      };

      const req = new NextRequest("http://localhost/api/entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [1, 2] }),
      });

      const handler = DELETE as unknown as RawHandler;
      const response = await handler(req, sampleUser, mockDb, context);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.deleted_count).toBe(2);
    });
  });
});
