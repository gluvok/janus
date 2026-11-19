"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  useNotificationStore,
  type EntryNotification,
  sortNotifications,
} from "@/lib/store/notifications";
import { useAuthStore, useEntitiesStore } from "@/lib/store";
import { toast } from "sonner";

export function useEntryNotifications() {
  const user = useAuthStore((s) => s.user);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const setNotifications = useNotificationStore((s) => s.setNotifications);

  const isCatchingUpRef = useRef(true);
  const bufferRef = useRef<EntryNotification[]>([]);

  useEffect(() => {
    if (!user || !user.factory_id) return;

    isCatchingUpRef.current = true;
    bufferRef.current = [];

    const channel = supabase
      .channel("realtime-entries")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "entries",
        },
        (payload) => {
          const newEntry = payload.new as {
            id: number;
            vehicle_number?: string;
            detected_vehicle_number?: string;
            weight?: number;
            center_id?: number;
            created_at?: string;
          };

          const plate =
            newEntry.vehicle_number || newEntry.detected_vehicle_number || "Unidentified";
          const weightKg = newEntry.weight ? `${newEntry.weight.toLocaleString()} kg` : "0 kg";

          const notifItem: EntryNotification = {
            id: `entry-${newEntry.id}`,
            entryId: newEntry.id,
            title: "New Vehicle Entry",
            vehicleNumber: plate,
            weight: newEntry.weight || 0,
            centerName: `Center #${newEntry.center_id || 1}`,
            createdAt: newEntry.created_at || new Date().toISOString(),
            read: false,
          };

          if (isCatchingUpRef.current) {
            // Buffer events received while handshake / catchup GET is pending
            bufferRef.current.push(notifItem);
          } else {
            addNotification(notifItem);
            toast.info(`New Weighment Entry: ${plate}`, {
              description: `Weight: ${weightKg}`,
            });

            try {
              useEntitiesStore.getState().triggerEntitiesUpdate();
            } catch {
              // Ignore if store uninitialized
            }
          }
        },
      )
      .subscribe(async (status, err) => {
        if (err) {
          console.error("[Realtime] Subscription error:", err);
          return;
        }

        if (status === "SUBSCRIBED") {
          console.log("[Realtime] Connected and listening for entries");

          // Catchup: fetch unread & recent notifications after socket is established
          try {
            const res = await fetch("/api/notifications");
            if (res.ok) {
              const data = await res.json();
              const historical: EntryNotification[] = Array.isArray(data.notifications)
                ? data.notifications
                : [];

              // Merge historical and buffered entries deduplicating by id
              const seenIds = new Set<string>();
              const merged: EntryNotification[] = [];

              for (const item of bufferRef.current) {
                if (!seenIds.has(item.id)) {
                  seenIds.add(item.id);
                  merged.push(item);
                }
              }

              for (const item of historical) {
                if (!seenIds.has(item.id)) {
                  seenIds.add(item.id);
                  merged.push(item);
                }
              }

              setNotifications(sortNotifications(merged));
            }
          } catch (fetchErr) {
            console.error("[Notifications] Catchup fetch error:", fetchErr);
          } finally {
            isCatchingUpRef.current = false;
            bufferRef.current = [];
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, addNotification, setNotifications]);
}
