"use client";

/**
 * @file components/dashboard/notifications.tsx
 * @description Dashboard bell + inline expandable feed of recent entries and weighments.
 */

import * as React from "react";
import Link from "next/link";
import axios from "axios";
import { formatDistanceToNowStrict } from "date-fns";
import { Bell, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ApiRoutes } from "@/lib/constants/routes";
import { EntrySource, ProjectSlug } from "@/lib/constants/enums";
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

export function DashboardNotifications({ username }: { username: string }) {
  const [open, setOpen] = React.useState(false);
  // Rendered only after client-side auth hydration; readSeen's try/catch covers a missing localStorage.
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
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell data-icon="inline-start" />
          Activity
          {unread > 0 && <Badge className="min-w-5 px-1.5 tabular-nums">{unread}</Badge>}
          <ChevronDown
            data-icon="inline-end"
            className={cn("transition-transform", open && "rotate-180")}
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3">
        <div className="rounded-xl border bg-card">
          {error && items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Couldn&apos;t load activity. Retrying…
            </p>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No entries or weighments in the last 24 hours.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <NotificationRow key={`${n.kind}-${n.id}`} n={n} />
              ))}
            </ul>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function NotificationRow({ n }: { n: DashboardNotification }) {
  const slug = n.kind === "entry" ? ProjectSlug.ENTRIES : ProjectSlug.WEIGHMENTS;
  const href = `/projects/${slug}?search=${encodeURIComponent(n.vehicle_number)}`;

  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-4 px-4 py-3 hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
      >
        <span className="font-mono text-sm font-semibold tracking-wider">{n.vehicle_number}</span>
        <span className="flex-1 truncate text-sm text-muted-foreground">
          {n.kind === "entry" ? (
            <>
              New entry · {n.weight.toLocaleString()} kg · {n.center_name ?? "—"} ·{" "}
              {n.source === EntrySource.DEVICE ? "Device" : "Manual"}
              {n.auto_approved && " (auto)"}
              {n.detected_vehicle_number && n.detected_vehicle_number !== n.vehicle_number && (
                <>
                  {" "}
                  · detected: <span className="font-mono">{n.detected_vehicle_number}</span>
                </>
              )}
            </>
          ) : (
            <>
              Weighment · net {n.net_weight.toLocaleString()} {n.unit} (
              {n.in_weight.toLocaleString()} → {n.out_weight.toLocaleString()}) ·{" "}
              {n.center_name ?? "—"}
            </>
          )}
        </span>
        <Badge variant="secondary" className="capitalize">
          {n.kind === "entry" ? n.status : n.type}
        </Badge>
        <time
          dateTime={n.created_at}
          className="w-20 shrink-0 text-right text-xs text-muted-foreground"
        >
          {formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}
        </time>
      </Link>
    </li>
  );
}
