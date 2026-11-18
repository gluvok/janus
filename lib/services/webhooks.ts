/**
 * @file lib/services/webhooks.ts
 * @description Outgoing webhook dispatcher with HMAC-SHA256 signature verification and delivery tracking.
 */

import { createHmac } from "node:crypto";
import { supabase as defaultClient } from "@/lib/supabase";

export interface DispatchWebhookOptions {
  factoryId: number;
  event: string;
  payload: Record<string, unknown>;
  client?: any;
}

export interface WebhookDispatchResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * Computes HMAC-SHA256 signature string for webhook payload verification.
 */
export function signWebhookPayload(payloadString: string, secret: string): string {
  const hmac = createHmac("sha256", secret).update(payloadString).digest("hex");
  return `sha256=${hmac}`;
}

/**
 * Dispatches a signed webhook payload to the factory's configured endpoint and records delivery log.
 */
export async function dispatchWebhook({
  factoryId,
  event,
  payload,
  client = defaultClient,
}: DispatchWebhookOptions): Promise<WebhookDispatchResult | null> {
  const { data: factory } = await client
    .from("factories")
    .select("webhook_url, webhook_secret")
    .eq("id", factoryId)
    .single();

  if (!factory?.webhook_url) {
    return null;
  }

  const payloadString = JSON.stringify({
    event,
    factory_id: factoryId,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const signature = factory.webhook_secret
    ? signWebhookPayload(payloadString, factory.webhook_secret)
    : "";

  try {
    const res = await fetch(factory.webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gluvok-Event": event,
        "X-Gluvok-Signature": signature,
      },
      body: payloadString,
      signal: AbortSignal.timeout(5000),
    });

    const isSuccess = res.ok;
    const statusCode = res.status;

    await client.from("webhook_logs").insert({
      factory_id: factoryId,
      event,
      payload,
      status: isSuccess ? "delivered" : "failed",
      response_status: statusCode,
      attempts: 1,
      delivered_at: isSuccess ? new Date().toISOString() : null,
      last_error: isSuccess ? null : `HTTP status ${statusCode}`,
    });

    return { success: isSuccess, statusCode };
  } catch (err: any) {
    const errorMsg = err?.message || "Webhook delivery failed";

    await client.from("webhook_logs").insert({
      factory_id: factoryId,
      event,
      payload,
      status: "failed",
      attempts: 1,
      last_error: errorMsg,
    });

    return { success: false, error: errorMsg };
  }
}
