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
import { badgeBaseClass } from "@/components/projects/columns/helpers";
import { EntrySource, ProjectSlug } from "@/lib/constants/enums";
import { getStatusColorClass, getStatusIcon, getTypeColorClass, getTypeIcon } from "@/lib/fields";
import { PROJECTS } from "@/lib/projects";
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

export function DashboardNotifications({
  username,
  heading,
}: {
  username: string;
  heading?: React.ReactNode;
}) {
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
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
        {heading}
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          >
            <span className="relative inline-flex">
              <Bell data-icon="inline-start" />
              {unread > 0 && (
                <span
                  aria-hidden
                  className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary animate-pulse motion-reduce:animate-none"
                />
              )}
            </span>
            Activity
            {unread > 0 && <Badge className="min-w-5 px-1.5 tabular-nums">{unread}</Badge>}
            <ChevronDown
              data-icon="inline-end"
              className={cn("transition-transform", open && "rotate-180")}
            />
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="mt-4">
        <div className="overflow-hidden rounded-xl border bg-card">
          {error && items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Couldn&apos;t load activity. Retrying…
            </p>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No entries or weighments in the last 24 hours.
            </p>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto">
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

const projectBySlug = new Map(PROJECTS.map((p) => [p.slug, p]));

function NotificationRow({ n }: { n: DashboardNotification }) {
  const slug = n.kind === "entry" ? ProjectSlug.ENTRIES : ProjectSlug.WEIGHMENTS;
  const href = `/projects/${slug}?search=${encodeURIComponent(n.vehicle_number)}`;

  const project = projectBySlug.get(slug);
  const status = n.kind === "entry" ? n.status : n.type;
  const StatusIcon = n.kind === "entry" ? getStatusIcon(status) : getTypeIcon(status);
  const statusColor = n.kind === "entry" ? getStatusColorClass(status) : getTypeColorClass(status);

  return (
    <li>
      <Link
        href={href}
        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none sm:items-center"
      >
        {project && (
          <span
            aria-hidden
            className={cn(
              "mt-0.5 shrink-0 rounded-md border p-1.5 sm:mt-0",
              project.theme?.badgeBg,
              project.theme?.badgeBorder,
              project.theme?.iconColor,
            )}
          >
            <project.icon className="size-3.5" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 sm:flex-nowrap">
          <span className="rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-sm font-semibold tracking-widest uppercase">
            {n.vehicle_number}
          </span>
          <time
            dateTime={n.created_at}
            className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums sm:order-last sm:ml-0 sm:w-20 sm:text-right"
          >
            {formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}
          </time>
          <span className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
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
            <span className={cn(badgeBaseClass, "shrink-0 gap-1 capitalize", statusColor)}>
              <StatusIcon className="size-3 shrink-0" />
              {status}
            </span>
          </span>
        </div>
      </Link>
    </li>
  );
}
