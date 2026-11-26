import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";
import { Role, Unit } from "@/lib/constants/enums";
import { useAuthStore } from "@/lib/store";
import { NotificationBell } from "./notification-bell";

vi.mock("axios");

const entry = {
  kind: "entry",
  ref_id: 1,
  vehicle_number: "UP32AB1234",
  weight: 15000,
  unit: Unit.KG,
  created_at: new Date().toISOString(),
};

const loginAs = (role: Role) =>
  useAuthStore.setState({
    hydrated: true,
    user: { username: "op", name: "Op", role } as ReturnType<typeof useAuthStore.getState>["user"],
  });

describe("NotificationBell", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(axios.get).mockResolvedValue({ data: { data: [entry] } });
    loginAs(Role.OPERATOR);
  });

  it("shows an unread count, opens the overlay, and clears the count once opened", async () => {
    render(<NotificationBell />);
    const bell = await screen.findByRole("button", { name: /1 unread/i });

    fireEvent.click(bell);
    expect(await screen.findByText("UP32AB1234")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /notifications/i })).not.toHaveAccessibleName(
        /unread/i,
      ),
    );
  });

  it("links each item to its table filtered by plate", async () => {
    render(<NotificationBell />);
    fireEvent.click(await screen.findByRole("button", { name: /notifications/i }));
    const link = await screen.findByRole("link", { name: /UP32AB1234/ });
    expect(link).toHaveAttribute("href", "/projects/entries?search=UP32AB1234");
  });

  it("renders nothing for roles without entries or weighments access", () => {
    loginAs(Role.HARDWARE);
    const { container } = render(<NotificationBell />);
    expect(container).toBeEmptyDOMElement();
  });
});
