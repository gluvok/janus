"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useNotificationStore } from "@/lib/store/notifications";
import { useAuthStore, useEntitiesStore } from "@/lib/store";
import { toast } from "sonner";

export function useEntryNotifications() {
  const user = useAuthStore((s) => s.user);
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    if (!user || !user.factory_id) return;

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

          addNotification({
            id: `entry-${newEntry.id}`,
            entryId: newEntry.id,
            title: "New Vehicle Entry",
            vehicleNumber: plate,
            weight: newEntry.weight || 0,
            centerName: `Center #${newEntry.center_id || 1}`,
            createdAt: newEntry.created_at || new Date().toISOString(),
          });

          toast.info(`New Weighment Entry: ${plate}`, {
            description: `Weight: ${weightKg}`,
          });

          try {
            useEntitiesStore.getState().triggerEntitiesUpdate();
          } catch {
            // Ignore if store uninitialized
          }
        },
      )
      .subscribe((status, err) => {
        if (err) {
          console.error("[Realtime] Subscription error:", err);
        } else if (status === "SUBSCRIBED") {
          console.log("[Realtime] Connected and listening for entries");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, addNotification]);
}
