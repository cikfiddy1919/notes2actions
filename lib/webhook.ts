import "server-only"; // build fails if this module is ever imported into client code

import type { ExtractResult } from "./types";

const TIMEOUT_MS = 5_000;

// Best-effort POST of a processed note to N8N_WEBHOOK_URL. Never throws: a missing URL
// is a no-op, and any failure (bad URL, timeout, non-2xx) is only logged.
export async function notifyN8n({ title, summary, action_items }: ExtractResult): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, summary, action_items }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`n8n webhook responded ${res.status}`);
    }
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "TimeoutError"
        ? `timed out after ${TIMEOUT_MS}ms`
        : err instanceof Error
          ? `${err.message}${err.cause instanceof Error ? ` (${err.cause.message || err.cause.name})` : ""}`
          : String(err);
    console.error(`n8n webhook failed: ${reason}`);
  }
}
