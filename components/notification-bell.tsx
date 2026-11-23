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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ApiRoutes } from "@/lib/constants/routes";
import { ProjectSlug } from "@/lib/constants/enums";
import { PROJECTS } from "@/lib/projects";
import { useAuthStore, hasPageAccess } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { DashboardNotification } from "@/types";

const POLL_MS = 30_000;
const seenKey = (username: string) => `notifications-seen:${username}`;
const toMs = (iso: string) => new Date(iso).getTime() || 0;

function readSeen(username: string): string {
  try {
    return localStorage.getItem(seenKey(username)) ?? "";
  } catch {
    return "";
  }
}

function useNotifications(open: boolean) {
  const [items, setItems] = React.useState<DashboardNotification[]>([]);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await axios.get<{ data: DashboardNotification[] }>(ApiRoutes.NOTIFICATIONS);
      setItems(res.data.data);
      setError(false);
    } catch (err) {
      console.error("Failed to load notifications:", err);
      setError(true);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return { items, error };
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
  return <BellPopover key={user.username} username={user.username} />;
}

function BellPopover({ username }: { username: string }) {
  const [open, setOpen] = React.useState(false);
  const [seenAt, setSeenAt] = React.useState(() => readSeen(username));
  const { items, error } = useNotifications(open);

  const seenMs = toMs(seenAt);
  const unread = items.filter((n) => toMs(n.created_at) > seenMs).length;

  React.useEffect(() => {
    if (!open || items.length === 0) return;
    const newest = items[0].created_at;
    setSeenAt(newest);
    try {
      localStorage.setItem(seenKey(username), newest);
    } catch {
      /* storage blocked: unread just resets next load */
    }
  }, [open, items, username]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className={cn(
          "relative grid size-10 place-items-center rounded-full bg-background text-muted-foreground transition-all duration-200",
          "shadow-[4px_4px_10px_rgba(0,0,0,0.08),-4px_-4px_10px_rgba(255,255,255,0.9)]",
          "dark:shadow-[4px_4px_10px_rgba(0,0,0,0.5),-4px_-4px_10px_rgba(255,255,255,0.04)]",
          "hover:text-foreground active:scale-95",
          "data-[state=open]:text-foreground data-[state=open]:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.1),inset_-3px_-3px_7px_rgba(255,255,255,0.9)]",
          "dark:data-[state=open]:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.5),inset_-3px_-3px_7px_rgba(255,255,255,0.04)]",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        )}
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-80 gap-0 overflow-hidden rounded-2xl border border-white/30 bg-popover/55 p-0 shadow-2xl backdrop-blur-xl backdrop-saturate-150 dark:border-white/10"
      >
        <p className="px-4 pt-3 pb-2 text-xs font-medium text-muted-foreground">Last 24 hours</p>
        {error && items.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">Couldn&apos;t load. Retrying…</p>
        ) : items.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">Nothing new.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto pb-1.5">
            {items.map((n) => (
              <Row key={`${n.kind}-${n.id}`} n={n} onPick={() => setOpen(false)} />
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
              "shrink-0 rounded-lg p-1.5",
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
            {n.kind === "entry"
              ? `Entry · ${n.weight.toLocaleString()} kg`
              : `Weighment · net ${n.net_weight.toLocaleString()} ${n.unit}`}
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
