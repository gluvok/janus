import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import {
  deleteRows,
  fetchEntityPaginatedFromApi,
  insertRow,
  updateRow,
  apiRequest,
  sanitizeSearchTerm,
} from "./common";
import { ProjectSlug, Unit } from "@/lib/constants/enums";
import { useAuthStore } from "@/lib/store/auth";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(() => false),
  },
}));

describe("fetchEntityPaginatedFromApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards sort params to API", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        data: [{ id: 1, name: "Alpha" }],
        pagination: { total: 1 },
      },
    });

    const result = await fetchEntityPaginatedFromApi(ProjectSlug.CENTERS, {
      page: 1,
      pageSize: 10,
      search: "al",
      sortColumn: "name",
      sortDesc: true,
      filters: { unit: Unit.KG },
    });

    expect(axios.get).toHaveBeenCalledWith("/api/centers", {
      params: {
        page: 2,
        limit: 10,
        search: "al",
        sort_column: "name",
        sort_desc: true,
        unit: Unit.KG,
      },
    });

    expect(result).toEqual({
      data: [{ id: 1, name: "Alpha" }],
      count: 1,
    });
  });
});

describe("insertRow & updateRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("insertRow returns inserted record", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        data: { id: 10, username: "newuser" },
      },
    });

    const result = await insertRow(ProjectSlug.USERS, { username: "newuser" });
    expect(result).toEqual({ id: 10, username: "newuser" });
  });

  it("updateRow returns updated record", async () => {
    vi.mocked(axios.patch).mockResolvedValue({
      data: {
        data: { id: 10, name: "Updated Name" },
      },
    });

    const result = await updateRow(ProjectSlug.USERS, 10, { name: "Updated Name" });
    expect(result).toEqual({ id: 10, name: "Updated Name" });
  });

  it("updateRow preserves is_self_password_changed flag", async () => {
    vi.mocked(axios.patch).mockResolvedValue({
      data: {
        data: { id: 10, name: "Updated Name" },
        is_self_password_changed: true,
      },
    });

    const result = await updateRow(ProjectSlug.USERS, 10, { password: "newpassword" });
    expect(result).toEqual({ id: 10, name: "Updated Name", is_self_password_changed: true });
  });
});

describe("deleteRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends one collection DELETE request containing all selected IDs", async () => {
    vi.mocked(axios.delete).mockResolvedValue({ data: { deleted_count: 3 } });

    await expect(deleteRows(ProjectSlug.CUSTOMERS, [1, 2, 3])).resolves.toBe(3);

    expect(axios.delete).toHaveBeenCalledWith("/api/customers", {
      data: { ids: [1, 2, 3] },
    });
  });
});

describe("apiRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears auth session on 401 response", async () => {
    const clearSessionSpy = vi.spyOn(useAuthStore.getState(), "clearSession");

    const error = {
      isAxiosError: true,
      response: {
        status: 401,
        data: { error: "Unauthorized" },
      },
    };

    vi.mocked(axios.isAxiosError).mockReturnValue(true);

    await expect(
      apiRequest(async () => {
        throw error;
      }),
    ).rejects.toThrow("Unauthorized");

    expect(clearSessionSpy).toHaveBeenCalled();
  });
});

describe("sanitizeSearchTerm", () => {
  it("strips PostgREST AST injection characters and operators", () => {
    const raw = "KA01AB1234),id.gt.0,name.eq.foo";
    const cleaned = sanitizeSearchTerm(raw);
    expect(cleaned).toBe("KA01AB1234idgt0nameeqfoo");
    expect(cleaned).not.toContain(",");
    expect(cleaned).not.toContain(")");
    expect(cleaned).not.toContain("(");
    expect(cleaned).not.toContain(".");
  });

  it("handles empty or whitespace inputs gracefully", () => {
    expect(sanitizeSearchTerm("")).toBe("");
    expect(sanitizeSearchTerm("   ")).toBe("");
  });
});
