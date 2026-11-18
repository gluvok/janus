/**
 * @file lib/services/webhooks.ts
 * @description Outgoing webhook dispatcher engine with HMAC-SHA256 signatures,
 * replay protection, timeout isolation, and exponential backoff retry sweeper.
 */

import crypto from "node:crypto";
import { supabase as defaultClient } from "@/lib/supabase";

export const MAX_WEBHOOK_ATTEMPTS = 5;
export const WEBHOOK_TIMEOUT_MS = 5000;
export const WEBHOOK_TOLERANCE_SECONDS = 300; // 5 minutes

/**
 * Validates outgoing webhook destination URL against SSRF and cloud metadata endpoints.
 */
export function isValidWebhookUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (!["https:", "http:"].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "169.254.169.254" ||
      hostname === "metadata.google.internal" ||
      hostname === "instance-data"
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export interface DispatchOptions {
  factoryId: number;
  event: string;
  payload: Record<string, unknown>;
  client?: any;
}

export interface DispatchResult {
  success: boolean;
  logId?: number;
  statusCode?: number;
  error?: string;
}

/**
 * Creates canonical timestamped signature: t=<timestamp>,v1=<hmac_sha256>
 */
export function signWebhookPayload(
  payload: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): string {
  const signaturePayload = `${timestamp}.${payload}`;
  const hmac = crypto.createHmac("sha256", secret).update(signaturePayload).digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

/**
 * Validates timestamped signature header and rejects replays older than 5 minutes.
 */
export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;

  const tMatch = signatureHeader.match(/t=(\d+)/);
  const v1Match = signatureHeader.match(/v1=([a-f0-9]{64})/);
  if (!tMatch || !v1Match) return false;

  const timestamp = parseInt(tMatch[1], 10);
  const receivedHmac = v1Match[1];

  // Replay window check: must be within +/- 300s
  const currentTimestamp = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTimestamp - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }

  const expectedPayload = `${timestamp}.${payload}`;
  const expectedHmac = crypto.createHmac("sha256", secret).update(expectedPayload).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(receivedHmac, "hex"), Buffer.from(expectedHmac, "hex"));
  } catch {
    return false;
  }
}

/**
 * Dispatches a webhook asynchronously with retry scheduling on failure.
 */
export async function dispatchWebhook({
  factoryId,
  event,
  payload,
  client = defaultClient,
}: DispatchOptions): Promise<DispatchResult> {
  const { data: factory } = await client
    .from("factories")
    .select("webhook_url, webhook_secret")
    .eq("id", factoryId)
    .single();

  if (!factory?.webhook_url) {
    return { success: false, error: "No webhook_url configured" };
  }

  if (!isValidWebhookUrl(factory.webhook_url)) {
    return { success: false, error: "Invalid webhook_url (protocol or host forbidden)" };
  }

  // 1. Insert initial log record in pending state
  const { data: log, error: logError } = await client
    .from("webhook_logs")
    .insert({
      factory_id: factoryId,
      event,
      payload,
      status: "pending",
      attempt_count: 0,
      next_attempt_at: new Date().toISOString(),
    })
    .select("id, attempt_count")
    .single();

  if (logError || !log) {
    return { success: false, error: logError?.message || "Failed to create webhook log" };
  }

  return executeWebhookDelivery({
    logId: log.id,
    url: factory.webhook_url,
    secret: factory.webhook_secret || "",
    event,
    payload,
    attemptCount: log.attempt_count || 0,
    client,
  });
}

/**
 * Internal delivery execution with timeout and retry calculation.
 */
async function executeWebhookDelivery({
  logId,
  url,
  secret,
  event,
  payload,
  attemptCount,
  client,
}: {
  logId: number;
  url: string;
  secret: string;
  event: string;
  payload: Record<string, unknown>;
  attemptCount: number;
  client: any;
}): Promise<DispatchResult> {
  const jsonBody = JSON.stringify(payload);
  const signatureHeader = signWebhookPayload(jsonBody, secret);
  const currentAttempt = attemptCount + 1;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gluvok-Event": event,
        "X-Gluvok-Signature": signatureHeader,
      },
      body: jsonBody,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (res.ok) {
      await client
        .from("webhook_logs")
        .update({
          status: "delivered",
          response_status: res.status,
          attempt_count: currentAttempt,
          delivered_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", logId);

      return { success: true, logId, statusCode: res.status };
    }

    throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
  } catch (err: any) {
    const isTerminal = currentAttempt >= MAX_WEBHOOK_ATTEMPTS;
    const nextDelaySeconds = Math.min(2 ** currentAttempt * 15, 3600); // Exponential backoff
    const nextAttemptAt = new Date(Date.now() + nextDelaySeconds * 1000).toISOString();

    await client
      .from("webhook_logs")
      .update({
        status: isTerminal ? "failed" : "retrying",
        attempt_count: currentAttempt,
        next_attempt_at: nextAttemptAt,
        last_error: err?.message || String(err),
      })
      .eq("id", logId);

    return { success: false, logId, error: err?.message || String(err) };
  }
}

/**
 * Sweeper for scheduled retries claiming overdue rows.
 */
export async function sweepPendingWebhooks(client = defaultClient): Promise<number> {
  const { data: overdueLogs } = await client
    .from("webhook_logs")
    .select("id, factory_id, event, payload, attempt_count, factories(webhook_url, webhook_secret)")
    .in("status", ["pending", "retrying"])
    .lte("next_attempt_at", new Date().toISOString())
    .lt("attempt_count", MAX_WEBHOOK_ATTEMPTS)
    .order("next_attempt_at", { ascending: true })
    .limit(25);

  if (!overdueLogs || overdueLogs.length === 0) return 0;

  let swept = 0;
  for (const item of overdueLogs) {
    const factoryObj = Array.isArray(item.factories) ? item.factories[0] : item.factories;
    if (factoryObj?.webhook_url) {
      await executeWebhookDelivery({
        logId: item.id,
        url: factoryObj.webhook_url,
        secret: factoryObj.webhook_secret || "",
        event: item.event,
        payload: item.payload as Record<string, unknown>,
        attemptCount: item.attempt_count,
        client,
      });
      swept++;
    }
  }

  return swept;
}
