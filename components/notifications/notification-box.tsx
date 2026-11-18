"use client";

import * as React from "react";
import { Bell, CheckCheck, Truck, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotificationStore } from "@/lib/store/notifications";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export function NotificationBox() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 sm:w-96" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">Notifications</h4>
            {unreadCount > 0 && <Badge variant="secondary">{unreadCount} new</Badge>}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto divide-y">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No entries received yet
            </div>
          ) : (
            notifications.map((item) => (
              <Link
                key={item.id}
                href={`/projects/entries?search=${encodeURIComponent(item.vehicleNumber)}`}
                onClick={() => markAsRead(item.id)}
                className={`flex items-start gap-3 p-3 transition-colors hover:bg-muted/50 ${
                  !item.read ? "bg-muted/20 font-medium" : ""
                }`}
              >
                <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                  <Truck className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{item.vehicleNumber}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Scale className="h-3 w-3" /> {item.weight.toLocaleString()} kg &bull; {item.centerName}
                  </div>
                </div>
                {!item.read && <span className="h-2 w-2 rounded-full bg-primary" />}
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
