import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProjectTable } from "./use-table";
import { fetchEntityListPaginated } from "@/lib/services";
import { getProjectColumns } from "@/components/projects/columns";

const mockTriggerEntitiesUpdate = vi.fn();
const mockPreferencesState = {
  columns: {} as Record<string, string[]>,
  filters: {} as Record<string, Record<string, unknown>>,
  setColumnPreferences: vi.fn(),
  setFilterPreferences: vi.fn(),
};

interface MockAuthStoreState {
  user: {
    role: string;
  };
}

interface MockEntitiesStoreState {
  entitiesUpdatedTrigger: number;
  triggerEntitiesUpdate: () => void;
}

interface MockPreferencesStoreState {
  columns: Record<string, string[]>;
  filters: Record<string, Record<string, unknown>>;
  setColumnPreferences: () => void;
  setFilterPreferences: () => void;
}

// Mock dependencies
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

vi.mock("@/lib/store", () => {
  const mockAuthStore = {
    getState: () => ({
      user: {
        role: "admin",
      },
    }),
    subscribe: () => () => {},
  };

  const mockEntitiesStore = {
    getState: () => ({
      entitiesUpdatedTrigger: 0,
      triggerEntitiesUpdate: mockTriggerEntitiesUpdate,
      fetchCenters: vi.fn().mockResolvedValue([]),
      fetchUsers: vi.fn().mockResolvedValue([]),
      fetchCustomers: vi.fn().mockResolvedValue([]),
      fetchRates: vi.fn().mockResolvedValue([]),
      fetchCommodities: vi.fn().mockResolvedValue([]),
    }),
    subscribe: () => () => {},
  };

  const mockPreferencesStore = {
    getState: () => mockPreferencesState,
    subscribe: () => () => {},
  };

  const useAuthStoreMock = Object.assign(
    (selector: (state: MockAuthStoreState) => unknown) => selector(mockAuthStore.getState()),
    mockAuthStore,
  );

  const useEntitiesStoreMock = Object.assign(
    (selector: (state: MockEntitiesStoreState) => unknown) =>
      selector(mockEntitiesStore.getState()),
    mockEntitiesStore,
  );

  const usePreferencesStoreMock = Object.assign(
    (selector: (state: MockPreferencesStoreState) => unknown) =>
      selector(mockPreferencesStore.getState()),
    mockPreferencesStore,
  );

  return {
    useAuthStore: useAuthStoreMock,
    useEntitiesStore: useEntitiesStoreMock,
    usePreferencesStore: usePreferencesStoreMock,
    getPermissions: () => ({
      read: true,
      write: true,
      delete: true,
      create: true,
      show: true,
    }),
  };
});

vi.mock("@/lib/services", () => ({
  fetchEntityListPaginated: vi.fn().mockResolvedValue({ data: [], count: 0 }),
}));

vi.mock("@/components/projects/columns", () => ({
  getProjectColumns: vi.fn().mockReturnValue([]),
}));

describe("useProjectTable Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreferencesState.columns = {};
    mockPreferencesState.filters = {};
    vi.mocked(getProjectColumns).mockReturnValue([]);
    vi.mocked(fetchEntityListPaginated).mockResolvedValue({ data: [], count: 0 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should initialize default states correctly and load data", async () => {
    vi.mocked(fetchEntityListPaginated).mockResolvedValue({
      data: [{ id: 1, name: "Item 1", created_at: "", updated_at: "" }],
      count: 1,
    });

    const { result } = renderHook(() =>
      useProjectTable({
        projectSlug: "centers",
        primaryIdKey: "id",
        projectName: "Centers",
      }),
    );

    // Advance timer to trigger the debounced search (300ms)
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Verify loading completes
    expect(result.current.isLoading).toBe(false);
    expect(result.current.creating).toBe(false);
    expect(result.current.editingItem).toBeNull();
    expect(result.current.deletingItem).toBeNull();

    expect(fetchEntityListPaginated).toHaveBeenCalledWith("centers", {
      page: 0,
      pageSize: 10,
      sortColumn: "created_at",
      sortDesc: true,
      search: "",
      filters: {},
    });
  });

  it("should debounce search input changes", async () => {
    vi.mocked(fetchEntityListPaginated).mockResolvedValue({ data: [], count: 0 });

    const { result } = renderHook(() =>
      useProjectTable({
        projectSlug: "centers",
        primaryIdKey: "id",
        projectName: "Centers",
      }),
    );

    // Initial load
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(fetchEntityListPaginated).toHaveBeenCalledTimes(1);

    // Set global search filter
    act(() => {
      result.current.table.setGlobalFilter("search-term");
    });

    // Immediate check - should not fire fetch yet due to 300ms debounce
    expect(fetchEntityListPaginated).toHaveBeenCalledTimes(1);

    // Advance timer to trigger debounced filter
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(fetchEntityListPaginated).toHaveBeenCalledTimes(2);
    expect(fetchEntityListPaginated).toHaveBeenLastCalledWith(
      "centers",
      expect.objectContaining({
        search: "search-term",
      }),
    );
  });

  it("should handle reload and reset search/sorting", async () => {
    const { result } = renderHook(() =>
      useProjectTable({
        projectSlug: "centers",
        primaryIdKey: "id",
        projectName: "Centers",
      }),
    );

    await act(async () => {
      result.current.handleReload();
    });

    expect(mockTriggerEntitiesUpdate).toHaveBeenCalled();
  });

  it("should expose an error when loading data fails", async () => {
    vi.mocked(fetchEntityListPaginated).mockRejectedValue(new Error("Network unavailable"));

    const { result } = renderHook(() =>
      useProjectTable({
        projectSlug: "centers",
        primaryIdKey: "id",
        projectName: "Centers",
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("Network unavailable");
  });

  it("should not set error state when loading data fails with Unauthorized", async () => {
    vi.mocked(fetchEntityListPaginated).mockRejectedValue(new Error("Unauthorized"));

    const { result } = renderHook(() =>
      useProjectTable({
        projectSlug: "centers",
        primaryIdKey: "id",
        projectName: "Centers",
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should apply column preferences that hydrate after the initial render", async () => {
    vi.mocked(getProjectColumns).mockReturnValue([{ id: "id" }, { id: "name" }, { id: "actions" }]);

    const { result, rerender } = renderHook(() =>
      useProjectTable({
        projectSlug: "centers",
        primaryIdKey: "id",
        projectName: "Centers",
      }),
    );

    expect(result.current.table.state.columnVisibility).toEqual({});

    await act(async () => {
      mockPreferencesState.columns = { centers: ["id"] };
      rerender();
    });

    expect(result.current.table.state.columnVisibility).toEqual({
      id: true,
      name: false,
      actions: true,
    });
  });
});
