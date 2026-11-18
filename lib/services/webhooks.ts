/**
 * @file lib/services/webhooks.ts
 * @description Outgoing webhook dispatch engine for real-time external event notifications.
 */

import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface WebhookResult {
  dispatched: boolean;
  status?: number;
  reason?: string;
}

/**
 * Computes an HMAC-SHA256 signature string for webhook payloads.
 */
export function createWebhookSignature(payloadString: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadString).digest("hex");
}

/**
 * Validates whether a target URL protocol is permitted for webhook dispatch.
 * Prevents SSRF attacks via file://, gopher://, or other internal protocols.
 */
function isValidWebhookUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Dispatches an event payload to a factory's configured webhook endpoint.
 * Non-blocking, times out after 5 seconds, and handles all network errors safely.
 */
export async function dispatchWebhook(
  client: SupabaseClient,
  factoryId: number,
  event: string,
  data: unknown,
): Promise<WebhookResult> {
  try {
    const { data: factory, error } = await client
      .from("factories")
      .select("webhook_url, webhook_secret")
      .eq("id", factoryId)
      .single();

    if (error || !factory?.webhook_url) {
      return { dispatched: false, reason: "no_webhook_url" };
    }

    if (!isValidWebhookUrl(factory.webhook_url)) {
      return { dispatched: false, reason: "invalid_url_protocol" };
    }

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      factory_id: factoryId,
      data,
    };

    const payloadString = JSON.stringify(payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Gluvok-Webhook-Dispatcher/1.0",
      "X-Gluvok-Event": event,
    };

    if (factory.webhook_secret) {
      headers["X-Gluvok-Signature"] = createWebhookSignature(
        payloadString,
        factory.webhook_secret,
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(factory.webhook_url, {
        method: "POST",
        headers,
        body: payloadString,
        signal: controller.signal,
      });

      return {
        dispatched: res.ok,
        status: res.status,
        reason: res.ok ? undefined : `HTTP ${res.status}`,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[Webhook] Dispatch failed for factory ${factoryId}:`, reason);
    return { dispatched: false, reason };
  }
}
