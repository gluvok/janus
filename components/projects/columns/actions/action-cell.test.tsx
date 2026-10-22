import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActionCell } from "./action-cell";
import { ProjectSlug, EntryStatus, EntrySource } from "@/lib/constants/enums";
import { type Entry } from "@/types";

const { mockUseEntitiesStore, mockCurrentUser, mockActionMenu } = vi.hoisted(() => {
  const user = {
    role: "admin",
    sub: "1",
    factory_id: 1,
  };
  const store = Object.assign(
    (selector?: (state: unknown) => unknown) =>
      selector ? selector({ addEntity: vi.fn(), updateEntity: vi.fn() }) : {},
    {
      getState: () => ({
        updateEntity: vi.fn(),
        addEntity: vi.fn(),
      }),
    },
  );
  const actionMenu = vi.fn(
    (props: { canApproveEntry: boolean; canRejectEntry: boolean; itemId: string }) => (
      <div
        data-testid={`action-menu-${props.itemId}`}
        data-can-approve={String(props.canApproveEntry)}
        data-can-reject={String(props.canRejectEntry)}
      />
    ),
  );
  return { mockUseEntitiesStore: store, mockCurrentUser: user, mockActionMenu: actionMenu };
});

vi.mock("@/lib/store", () => ({
  useAuthStore: (selector: (state: { user: typeof mockCurrentUser }) => unknown) =>
    selector({ user: mockCurrentUser }),
  useEntitiesStore: mockUseEntitiesStore,
  getField: (item: Record<string, unknown>, key: string) => item[key],
  hasPermission: () => true,
}));

vi.mock("./action-menu", () => ({
  ActionMenu: (props: Parameters<typeof mockActionMenu>[0]) => mockActionMenu(props),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/pdf", () => ({
  downloadPDF: vi.fn(),
}));

describe("ActionCell - Entry Approval Gating", () => {
  const dummyRow = {} as never;
  const dummyTable = {} as never;
  const dummyCallbacks = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onView: vi.fn(),
  };

  const createMockTestEntry = (id: number, vehicle_number: string): Entry => ({
    id,
    vehicle_number,
    detected_vehicle_number: vehicle_number,
    weight: 15000,
    source: EntrySource.MANUAL,
    center_id: 1,
    created_by: 1,
    status: EntryStatus.PENDING,
    auto_approved: false,
    images: [],
    created_at: "2026-08-31T00:00:00Z",
    updated_at: "2026-08-31T00:00:00Z",
  });

  const createProps = (item: Entry) => ({
    item,
    row: dummyRow,
    table: dummyTable,
    projectSlug: ProjectSlug.ENTRIES,
    primaryIdKey: "id",
    projectName: "Entries",
    callbacks: dummyCallbacks,
    canWrite: true,
    canDelete: true,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enables canApproveEntry when vehicle_number is a valid Indian plate", () => {
    const item = createMockTestEntry(1, "MH12AB1234");

    render(<ActionCell {...createProps(item)} />);
    const menu = screen.getByTestId("action-menu-1");
    expect(menu).toHaveAttribute("data-can-approve", "true");
    expect(menu).toHaveAttribute("data-can-reject", "true");
  });

  it("disables canApproveEntry when vehicle_number is NO_PLATE_DETECTED", () => {
    const item = createMockTestEntry(2, "NO_PLATE_DETECTED");

    render(<ActionCell {...createProps(item)} />);
    const menu = screen.getByTestId("action-menu-2");
    expect(menu).toHaveAttribute("data-can-approve", "false");
    expect(menu).toHaveAttribute("data-can-reject", "true");
  });

  it("disables canApproveEntry when vehicle_number is lowercase/spaced no plate detected", () => {
    const item = createMockTestEntry(3, "no plate detected");

    render(<ActionCell {...createProps(item)} />);
    const menu = screen.getByTestId("action-menu-3");
    expect(menu).toHaveAttribute("data-can-approve", "false");
    expect(menu).toHaveAttribute("data-can-reject", "true");
  });

  it("disables canApproveEntry when vehicle_number is invalid format", () => {
    const item = createMockTestEntry(4, "INVALID123");

    render(<ActionCell {...createProps(item)} />);
    const menu = screen.getByTestId("action-menu-4");
    expect(menu).toHaveAttribute("data-can-approve", "false");
    expect(menu).toHaveAttribute("data-can-reject", "true");
  });
});
