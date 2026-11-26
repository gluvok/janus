"use client";

/**
 * @file components/notification-bell.tsx
 * @description Global neumorphic bell with a glass popover of recent entries and weighments.
 */

import * as React from "react";
import Link from "next/link";
import axios from "axios";
import { formatDistanceToNowStrict } from "date-fns";
import { Bell } from "lucide-react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ApiRoutes } from "@/lib/constants/routes";
import { ProjectSlug } from "@/lib/constants/enums";
import { PROJECTS } from "@/lib/projects";
import { useAuthStore, hasPageAccess } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { DashboardNotification } from "@/types";

const LIMIT = 20; // matches GET /api/notifications
const RETRY_MS = 30_000;
const REFRESH_LEAD_MS = 60_000;
/** Invalid or empty ISO (e.g. no seenAt yet) is 0, so everything counts as newer. */
const toMs = (iso: string) => new Date(iso).getTime() || 0;

type RealtimeTokenResponse = {
  token: string;
  url: string;
  anonKey: string;
  topic: string;
  expiresAt: number;
};

function useNotifications() {
  const [items, setItems] = React.useState<DashboardNotification[]>([]);
  const [seenAt, setSeenAt] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);
  const mounted = React.useRef(false);

  const loadList = React.useCallback(async () => {
    try {
      const res = await axios.get<{ data: DashboardNotification[]; seenAt: string | null }>(
        ApiRoutes.NOTIFICATIONS,
      );
      if (!mounted.current) return;
      setItems(res.data.data);
      setSeenAt(res.data.seenAt);
      setError(false);
    } catch (err) {
      console.error("Failed to load notifications:", err);
      if (mounted.current) setError(true);
    }
  }, []);

  React.useEffect(() => {
    mounted.current = true;
    let stopped = false;
    let token = "";
    let client: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function connect() {
      try {
        const { data } = await axios.get<RealtimeTokenResponse>(ApiRoutes.REALTIME_TOKEN);
        if (stopped) return;
        token = data.token;
        // supabase-js always gives realtime an accessToken callback and re-reads it on connect,
        // join and every heartbeat; without this it would swap our token for the anon key.
        client ??= createClient(data.url, data.anonKey, { accessToken: async () => token });
        await client.realtime.setAuth(data.token);
        if (stopped) return;
        channel ??= client
          .channel(data.topic, { config: { private: true } })
          .on("broadcast", { event: "notification" }, ({ payload }) => {
            const raw = payload as DashboardNotification;
            const n = { ...raw, weight: Number(raw.weight) };
            setItems((prev) =>
              [n, ...prev.filter((p) => !(p.kind === n.kind && p.ref_id === n.ref_id))].slice(
                0,
                LIMIT,
              ),
            );
          })
          .subscribe((status) => {
            if (status === "SUBSCRIBED") void loadList(); // first join and every reconnect: catch up
          });
        timer = setTimeout(
          connect,
          Math.max(data.expiresAt - Date.now() - REFRESH_LEAD_MS, RETRY_MS),
        );
      } catch (err) {
        console.error("Realtime connect failed:", err);
        if (!stopped) timer = setTimeout(connect, RETRY_MS); // ponytail: fixed backoff
      }
    }

    void loadList();
    void connect();
    return () => {
      mounted.current = false;
      stopped = true;
      clearTimeout(timer);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [loadList]);

  const markSeen = React.useCallback(async () => {
    try {
      const res = await axios.post<{ seenAt: string }>(ApiRoutes.NOTIFICATIONS_SEEN);
      if (mounted.current) setSeenAt(res.data.seenAt);
    } catch (err) {
      console.error("Failed to mark notifications seen:", err);
    }
  }, []);

  return { items, seenAt, error, loadList, markSeen };
}

/** Mounted once in MainLayout; renders nothing for users who can't read entries or weighments. */
export function NotificationBell() {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const canSee =
    hydrated &&
    !!user &&
    (hasPageAccess(user.role, ProjectSlug.ENTRIES) ||
      hasPageAccess(user.role, ProjectSlug.WEIGHMENTS));

  if (!canSee) return null;
  return <BellPopover key={user.username} />;
}

function BellPopover() {
  const [open, setOpen] = React.useState(false);
  const { items, seenAt, error, loadList, markSeen } = useNotifications();

  const seenMs = toMs(seenAt ?? "");
  const unread = items.filter((n) => toMs(n.created_at) > seenMs).length;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && unread > 0) void markSeen();
        if (o && error) void loadList(); // keeps the "Retrying…" copy honest without polling
      }}
    >
      <PopoverTrigger
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className={cn(
          "relative grid size-10 place-items-center rounded-full bg-background text-muted-foreground neu transition-all duration-200",
          "hover:text-foreground active:scale-95 data-[state=open]:text-foreground data-[state=open]:neu-inset",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        )}
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary clay px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-80 gap-0 overflow-hidden rounded-2xl border border-white/30 p-0 shadow-2xl dark:border-white/10"
      >
        <p className="px-4 pt-3 pb-2 text-xs font-medium text-muted-foreground">Last 24 hours</p>
        {error && items.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">Couldn&apos;t load. Retrying…</p>
        ) : items.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">Nothing new.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto pb-1.5">
            {items.map((n) => (
              <Row key={`${n.kind}-${n.ref_id}`} n={n} onPick={() => setOpen(false)} />
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

const projectBySlug = new Map(PROJECTS.map((p) => [p.slug, p]));

function Row({ n, onPick }: { n: DashboardNotification; onPick: () => void }) {
  const slug = n.kind === "entry" ? ProjectSlug.ENTRIES : ProjectSlug.WEIGHMENTS;
  const project = projectBySlug.get(slug);

  return (
    <li>
      <Link
        href={`/projects/${slug}?search=${encodeURIComponent(n.vehicle_number)}`}
        onClick={onPick}
        className="mx-1.5 flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-foreground/5 focus-visible:bg-foreground/5 focus-visible:outline-none"
      >
        {project && (
          <span
            aria-hidden
            className={cn(
              "shrink-0 rounded-lg p-1.5 clay",
              project.theme?.badgeBg,
              project.theme?.iconColor,
            )}
          >
            <project.icon className="size-3.5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-sm font-semibold tracking-wider">
            {n.vehicle_number}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {`${n.kind === "entry" ? "Entry" : "Weighment · net"} · ${n.weight.toLocaleString()} ${n.unit}`}
          </span>
        </span>
        <time
          dateTime={n.created_at}
          className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground"
        >
          {formatDistanceToNowStrict(new Date(n.created_at))}
        </time>
      </Link>
    </li>
  );
}
