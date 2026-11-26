import { StrictMode } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { Role, Unit } from "@/lib/constants/enums";
import { ApiRoutes } from "@/lib/constants/routes";
import { useAuthStore } from "@/lib/store";
import { NotificationBell } from "./notification-bell";

const { handlers, channel, fakeClient } = vi.hoisted(() => {
  const handlers: {
    onBroadcast?: (m: { payload: unknown }) => void;
    onStatus?: (s: string) => void;
  } = {};
  const channel = {
    on: vi.fn((_t: unknown, _f: unknown, cb: typeof handlers.onBroadcast) => {
      handlers.onBroadcast = cb;
      return channel;
    }),
    subscribe: vi.fn((cb: typeof handlers.onStatus) => {
      handlers.onStatus = cb;
      return channel;
    }),
  };
  const fakeClient = {
    realtime: { setAuth: vi.fn() },
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  };
  return { handlers, channel, fakeClient };
});

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => fakeClient) }));
vi.mock("axios");

const entry = {
  kind: "entry",
  ref_id: 1,
  vehicle_number: "UP32AB1234",
  weight: 15000,
  unit: Unit.KG,
  created_at: new Date().toISOString(),
};

let list: unknown[] = [];

const loginAs = (role: Role) =>
  useAuthStore.setState({
    hydrated: true,
    user: { username: "op", name: "Op", role } as ReturnType<typeof useAuthStore.getState>["user"],
  });

const listCalls = () =>
  vi.mocked(axios.get).mock.calls.filter(([url]) => url === ApiRoutes.NOTIFICATIONS).length;

/** Renders the bell and waits until the channel has subscribed. */
async function renderSubscribed() {
  const view = render(<NotificationBell />);
  await waitFor(() => expect(channel.subscribe).toHaveBeenCalled());
  await act(async () => handlers.onStatus?.("SUBSCRIBED"));
  return view;
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete handlers.onBroadcast;
    delete handlers.onStatus;
    list = [entry];
    vi.mocked(axios.get).mockImplementation(async (url: string) =>
      url === ApiRoutes.REALTIME_TOKEN
        ? {
            data: {
              token: "t",
              url: "u",
              anonKey: "k",
              topic: "factory:1",
              expiresAt: Date.now() + 3600e3,
            },
          }
        : { data: { data: list, seenAt: null } },
    );
    vi.mocked(axios.post).mockImplementation(async () => ({
      data: { seenAt: new Date(Date.now() + 1000).toISOString() },
    }));
    loginAs(Role.OPERATOR);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("subscribes to the private topic from the token, authorising before subscribe", async () => {
    await renderSubscribed();

    expect(createClient).toHaveBeenCalledWith(
      "u",
      "k",
      expect.objectContaining({ accessToken: expect.any(Function) }),
    );
    const [, , opts] = vi.mocked(createClient).mock.calls[0];
    await expect(opts?.accessToken?.()).resolves.toBe("t");
    expect(fakeClient.channel).toHaveBeenCalledWith("factory:1", { config: { private: true } });
    expect(fakeClient.realtime.setAuth).toHaveBeenCalledWith("t");
    expect(fakeClient.realtime.setAuth.mock.invocationCallOrder[0]).toBeLessThan(
      channel.subscribe.mock.invocationCallOrder[0],
    );
  });

  it("shows a pushed notification as unread without polling", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    list = [];
    await renderSubscribed();

    act(() =>
      handlers.onBroadcast?.({
        payload: { ...entry, ref_id: 2, weight: "1500", created_at: new Date().toISOString() },
      }),
    );
    expect(await screen.findByRole("button", { name: /1 unread/i })).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(listCalls()).toBe(2); // mount + SUBSCRIBED, nothing on a timer

    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    expect(await screen.findByText(/1,500 kg/i)).toBeInTheDocument(); // string weight coerced
  });

  it("marks seen on the server when opened and clears the count", async () => {
    await renderSubscribed();
    const bell = await screen.findByRole("button", { name: /1 unread/i });

    fireEvent.click(bell);
    expect(await screen.findByText("UP32AB1234")).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledWith(ApiRoutes.NOTIFICATIONS_SEEN);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /notifications/i })).not.toHaveAccessibleName(
        /unread/i,
      ),
    );
  });

  it("ignores a duplicate push of the same kind and ref_id", async () => {
    await renderSubscribed();
    await screen.findByRole("button", { name: /1 unread/i });

    act(() => handlers.onBroadcast?.({ payload: { ...entry } }));

    expect(screen.getByRole("button", { name: /1 unread/i })).toBeInTheDocument();
  });

  it("removes the channel and stops the token refresh on unmount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { unmount } = await renderSubscribed();

    unmount();

    expect(fakeClient.removeChannel).toHaveBeenCalledWith(channel);
    await vi.advanceTimersByTimeAsync(3600e3);
    const tokenCalls = vi
      .mocked(axios.get)
      .mock.calls.filter(([url]) => url === ApiRoutes.REALTIME_TOKEN).length;
    expect(tokenCalls).toBe(1);
  });

  it("creates a single client and channel under StrictMode double-invoke", async () => {
    render(
      <StrictMode>
        <NotificationBell />
      </StrictMode>,
    );
    await waitFor(() => expect(channel.subscribe).toHaveBeenCalled());

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(fakeClient.channel).toHaveBeenCalledTimes(1);
  });

  it("links each item to its table filtered by plate", async () => {
    await renderSubscribed();
    fireEvent.click(await screen.findByRole("button", { name: /notifications/i }));
    const link = await screen.findByRole("link", { name: /UP32AB1234/ });
    expect(link).toHaveAttribute("href", "/projects/entries?search=UP32AB1234");
  });

  it("renders nothing and fetches nothing for roles without entries or weighments access", () => {
    loginAs(Role.HARDWARE);
    const { container } = render(<NotificationBell />);
    expect(container).toBeEmptyDOMElement();
    expect(axios.get).not.toHaveBeenCalled();
  });
});
