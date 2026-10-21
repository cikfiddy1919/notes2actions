import "server-only"; // build fails if this module is ever imported into client code

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

// Returns a service-role client, or null when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// aren't set — callers treat null as "saving disabled".
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client =
    url && key
      ? createClient(url, key, {
          // Server-side only: no browser session storage or token refresh.
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;
  return client;
}
