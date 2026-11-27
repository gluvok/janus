import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";
import { useUserStore } from "@/stores/use-user-store";
import { useFactoryStore } from "@/stores/use-factory-store";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/weighments",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

vi.mock("axios");

const mockUser = {
  id: 1,
  username: "op1",
  name: "Operator One",
  role: "operator" as const,
  factory_id: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const mockFactory = {
  id: 1,
  name: "Test Mill",
  receipt_images_per_row: 2,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("AppSidebar mobile AccountDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({ isInitialized: true, user: mockUser });
    useFactoryStore.setState({ factory: mockFactory });
    vi.mocked(axios.get).mockResolvedValue({
      data: { data: { user: mockUser, factory: mockFactory } },
    });
  });

  it("keeps AccountDialog open after mobile sidebar closes", async () => {
    render(
      <SidebarProvider>
        <SidebarTrigger />
        <AppSidebar />
      </SidebarProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));

    const userButton = await screen.findByText("@op1");
    fireEvent.click(userButton);

    const accountItem = await screen.findByText("Account");
    fireEvent.click(accountItem);

    await waitFor(() => {
      expect(screen.queryByText("Operations")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Account Settings")).toBeInTheDocument();
  });
});
