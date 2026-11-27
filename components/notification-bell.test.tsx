import { StrictMode } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { useUserStore } from "@/stores/use-user-store";
import type { UserRole } from "@/app/users/types";
import { NotificationBell } from "./notification-bell";

const LIST = "/api/notifications";
const SEEN = "/api/notifications/seen";
const TOKEN = "/api/realtime/token";

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
  source: "automatic",
  ref_id: 1,
  vehicle_number: "UP32AB1234",
  weight: 15000,
  created_at: new Date().toISOString(),
};

let list: unknown[] = [];

const loginAs = (role: UserRole) =>
  useUserStore.setState({
    isInitialized: true,
    user: {
      id: 1,
      username: "op",
      name: "Op",
      role,
      factory_id: 1,
      created_at: "",
      updated_at: "",
    },
  });

const listCalls = () => vi.mocked(axios.get).mock.calls.filter(([url]) => url === LIST).length;
const tokenCalls = () => vi.mocked(axios.get).mock.calls.filter(([url]) => url === TOKEN).length;

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
      url === TOKEN
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
    loginAs("operator");
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
    expect(axios.post).toHaveBeenCalledWith(SEEN);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /notifications/i })).not.toHaveAccessibleName(
        /unread/i,
      ),
    );
  });

  it("ignores a duplicate push of the same kind, source and ref_id", async () => {
    await renderSubscribed();
    await screen.findByRole("button", { name: /1 unread/i });

    act(() => handlers.onBroadcast?.({ payload: { ...entry } }));

    expect(screen.getByRole("button", { name: /1 unread/i })).toBeInTheDocument();
  });

  it("keeps an automatic and a manual item that share a ref_id", async () => {
    await renderSubscribed();
    await screen.findByRole("button", { name: /1 unread/i });

    act(() => handlers.onBroadcast?.({ payload: { ...entry, source: "manual" } }));

    expect(await screen.findByRole("button", { name: /2 unread/i })).toBeInTheDocument();
  });

  it("removes the channel and stops the token refresh on unmount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { unmount } = await renderSubscribed();

    unmount();

    expect(fakeClient.removeChannel).toHaveBeenCalledWith(channel);
    await vi.advanceTimersByTimeAsync(3600e3);
    expect(tokenCalls()).toBe(1);
  });

  it("does not retry the token on a 4xx", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url === TOKEN) throw { response: { status: 403 } };
      return { data: { data: list, seenAt: null } };
    });
    render(<NotificationBell />);
    await waitFor(() => expect(tokenCalls()).toBe(1));

    await act(() => vi.advanceTimersByTimeAsync(120_000));
    expect(tokenCalls()).toBe(1);
  });

  it("fetches a fresh token when the channel join is refused", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderSubscribed();

    await act(async () => handlers.onStatus?.("CHANNEL_ERROR"));
    await act(() => vi.advanceTimersByTimeAsync(30_000));

    expect(tokenCalls()).toBe(2);
    expect(fakeClient.realtime.setAuth).toHaveBeenCalledTimes(2);
    expect(createClient).toHaveBeenCalledTimes(1); // same client, new token
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

  it("links each item to its source table filtered by id", async () => {
    await renderSubscribed();
    fireEvent.click(await screen.findByRole("button", { name: /notifications/i }));
    const link = await screen.findByRole("link", { name: /UP32AB1234/ });
    expect(link).toHaveAttribute("href", "/entries/automatic?id=1");
  });

  it.each(["admin", "manager"] as const)("renders for %s (NOTIFY_ROLES)", async (role) => {
    loginAs(role);
    await renderSubscribed();
    expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
  });

  it("renders nothing and fetches nothing for base (not in NOTIFY_ROLES)", () => {
    loginAs("base");
    const { container } = render(<NotificationBell />);
    expect(container).toBeEmptyDOMElement();
    expect(axios.get).not.toHaveBeenCalled();
  });
});
