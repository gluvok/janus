import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";
import { EntryStatus, EntrySource } from "@/lib/constants/enums";
import { DashboardNotifications } from "./notifications";

vi.mock("axios");

const entry = {
  kind: "entry",
  id: 1,
  vehicle_number: "UP32AB1234",
  detected_vehicle_number: null,
  center_name: "Center A",
  created_at: new Date().toISOString(),
  weight: 15000,
  status: EntryStatus.PENDING,
  auto_approved: false,
  source: EntrySource.DEVICE,
};

describe("DashboardNotifications", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(axios.get).mockResolvedValue({ data: { data: [entry] } });
  });

  it("shows an unread count, expands inline, and clears the count once opened", async () => {
    render(<DashboardNotifications username="op" />);
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
    render(<DashboardNotifications username="op" />);
    fireEvent.click(await screen.findByRole("button", { name: /notifications/i }));
    const link = await screen.findByRole("link", { name: /UP32AB1234/ });
    expect(link).toHaveAttribute("href", "/projects/entries?search=UP32AB1234");
  });
});
