# Notes2Actions API

Every route takes and returns JSON, except that a successful `/api/speak` returns audio. Every error is returned in the same shape:

```json
{ "error": "Human-readable message" }
```

The messages are safe to show to users. More detail goes only to the server log.

## CORS

Cross-origin access is controlled by the `ALLOWED_ORIGINS` env var: a comma-separated list of exact origins, such as `https://app.example.com,http://localhost:5173`. It doesn't support wildcards, and an entry of `*` is ignored.

- **Same-origin requests** (the app's own page) and **requests with no `Origin` header** (curl, servers, n8n) are always handled normally.
- **Origins listed in `ALLOWED_ORIGINS`** get `Access-Control-Allow-Origin: <origin>` and `Vary: Origin` on every response.
- **Any other cross-origin request** is rejected with `403 {"error":"Origin not allowed."}` before the route does any work.
- **Preflight:** each route also answers `OPTIONS`. Allowed origins get `204` with `Access-Control-Allow-Methods: <route method>, OPTIONS`, `Access-Control-Allow-Headers: Content-Type` and `Access-Control-Max-Age: 600`. Any other origin gets `403` with an empty body.
- **If `ALLOWED_ORIGINS` is unset or empty**, no cross-origin request is allowed.

---

## `POST /api/process`

Extracts a title, summary and action items from meeting notes. It also saves the note to Supabase (if configured), and after a successful save sends it to the n8n webhook (if configured).

**Request**

```json
{ "notes": "sync w/ design - Sam to send mockups by Fri..." }
```

**Response `200`**

```json
{
  "title": "Design sync",
  "summary": "The team reviewed mockups and agreed on next steps.",
  "action_items": [
    { "task": "Send mockups", "owner": "Sam", "due": "Friday" },
    { "task": "Get budget sign-off" }
  ],
  "saved": true
}
```

- `owner` and `due` are left out when the notes don't state them.
- `saved` is `false` when Supabase isn't configured or the insert failed. The result is still returned either way.

**Errors**

| Status | When |
|---|---|
| 400 | Body isn't JSON, or `notes` is missing or blank |
| 403 | Cross-origin request from an origin not in `ALLOWED_ORIGINS` (see CORS) |
| 413 | `notes` is over 100,000 characters |
| 422 | The model declined, ran out of output room, or returned no structured result |
| 429 | Anthropic rate limit |
| 500 | Server misconfigured (bad Anthropic key) or unexpected error |
| 502 | Other Anthropic API error |

---

## `GET /api/notes`

Lists saved notes, newest first, up to 50.

**Request:** no body.

**Response `200`**

```json
{
  "configured": true,
  "notes": [
    {
      "id": "3f1c…-uuid",
      "created_at": "2026-10-21T15:42:10.123Z",
      "raw_text": "sync w/ design - Sam to send mockups by Fri...",
      "title": "Design sync",
      "summary": "The team reviewed mockups and agreed on next steps.",
      "action_items": [{ "task": "Send mockups", "owner": "Sam", "due": "Friday" }]
    }
  ]
}
```

When Supabase isn't configured, the response is `{ "configured": false, "notes": [] }` with status `200`.

**Errors**

| Status | When |
|---|---|
| 403 | Cross-origin request from an origin not in `ALLOWED_ORIGINS` (see CORS) |
| 500 | Database query failed |

---

## `POST /api/speak`

Reads a note aloud as MP3, using ElevenLabs' `eleven_multilingual_v2` model. The server writes the script itself: the title, the summary, then numbered action items with owner and due date.

**Request:** the same fields as a result. Any other fields, such as `id` or `saved`, are ignored.

```json
{
  "title": "Design sync",
  "summary": "The team reviewed mockups and agreed on next steps.",
  "action_items": [{ "task": "Send mockups", "owner": "Sam", "due": "Friday" }]
}
```

**Response `200`:** raw MP3 bytes, with `Content-Type: audio/mpeg` and `Cache-Control: no-store`. The body is not JSON.

**Errors**

| Status | When |
|---|---|
| 400 | Body isn't JSON, fields have the wrong types, or title and summary are both blank |
| 403 | Cross-origin request from an origin not in `ALLOWED_ORIGINS` (see CORS) |
| 413 | The generated script is over 3,000 characters |
| 429 | ElevenLabs is rate limiting |
| 502 | Couldn't reach ElevenLabs, or it returned an unexpected error |
| 503 | Listening isn't configured, the key is invalid or lacks permission, credits are used up, or the voice wasn't found |
| 500 | Unexpected error |
