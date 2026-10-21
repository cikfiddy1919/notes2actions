import "server-only";

const ALLOWED_HEADERS = "Content-Type";
const MAX_AGE_SECONDS = 600;

type Handler = (request: Request) => Promise<Response>;

// Exact origins from ALLOWED_ORIGINS (comma-separated). Unset or empty means no cross-origin
// access. "*" and anything that isn't a valid http(s) origin are ignored.
function allowedOrigins(): Set<string> {
  const origins = new Set<string>();
  for (const raw of (process.env.ALLOWED_ORIGINS ?? "").split(",")) {
    const value = raw.trim();
    if (!value || value === "*") continue;
    try {
      const url = new URL(value);
      if (url.protocol === "http:" || url.protocol === "https:") origins.add(url.origin);
    } catch {
      console.warn(`Ignoring invalid entry in ALLOWED_ORIGINS: ${value}`);
    }
  }
  return origins;
}

function isAllowed(origin: string): boolean {
  return allowedOrigins().has(origin);
}

// The app's own page calling its API. Browsers send Origin on same-origin POSTs too.
function isSameOrigin(request: Request, origin: string): boolean {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return host !== null && new URL(origin).host === host;
  } catch {
    return false;
  }
}

// Wraps a route handler: same-origin and non-browser requests pass through, allowed origins
// get CORS headers, and any other cross-origin request is rejected before the handler runs
// (so a "simple" cross-site POST can't trigger paid API calls).
export function withCors(handler: Handler): Handler {
  return async (request) => {
    const origin = request.headers.get("origin");
    if (!origin || isSameOrigin(request, origin)) {
      const res = await handler(request);
      res.headers.append("Vary", "Origin");
      return res;
    }
    if (!isAllowed(origin)) {
      return Response.json({ error: "Origin not allowed." }, { status: 403, headers: { Vary: "Origin" } });
    }
    const res = await handler(request);
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.append("Vary", "Origin");
    return res;
  };
}

// OPTIONS handler for preflight requests. `methods` is the route's methods, e.g. "POST".
export function corsPreflight(methods: string): Handler {
  return async (request) => {
    const origin = request.headers.get("origin");
    if (!origin || !isAllowed(origin)) {
      return new Response(null, { status: 403, headers: { Vary: "Origin" } });
    }
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": `${methods}, OPTIONS`,
        "Access-Control-Allow-Headers": ALLOWED_HEADERS,
        "Access-Control-Max-Age": String(MAX_AGE_SECONDS),
        Vary: "Origin",
      },
    });
  };
}
