# Notes2Actions

Paste messy meeting notes and get back a title, a short summary and a list of action items with owners and due dates. The result is saved, can be read aloud, and is emailed to me automatically.

**Live demo:** https://notes2actions.vercel.app

## Why I built it

I wanted to learn how to build with APIs, not just read about them. Before this project I had not used most of these tools. I picked a small, useful idea (turning meeting notes into to-dos) and used it as a reason to connect several services, one at a time, each with its own API key.

I built it in one afternoon, working with Claude Code in the terminal, as preparation for a hackathon. Each tool followed the same loop: create an account and get a key, store it in a local file, ask Claude Code to build the feature, test it locally, push to GitHub, add the key to Vercel, redeploy, and test the live site.

## What it does

1. You paste notes and click **Extract actions**.
2. The server asks the Claude API to return structured data: a title, a summary and action items.
3. The result is saved in a Supabase database and shown in a history list.
4. A **Listen** button reads the result aloud with ElevenLabs.
5. Each saved note is sent to an n8n workflow that emails it to me through Gmail.

A second front end, generated with Lovable, calls the same backend.

## Tools and APIs I used

| Tool | What I used it for | Key or URL |
| --- | --- | --- |
| Claude API | Turns messy notes into structured data | API key |
| Supabase | Stores notes in a Postgres database | Project URL and secret key |
| ElevenLabs | Text to speech for the Listen button | API key |
| n8n | Receives each note by webhook and sends an email | Webhook URL |
| Vercel | Hosts the app and redeploys on every push | Environment variables |
| GitHub | Stores the code | Login |
| Lovable | Generated a second front end | None, it calls my API |
| Claude Code | Wrote and edited the code from my prompts | Account login |

## Architecture

The browser page never sees a secret key. It calls my server routes, and the server talks to each service.

- `POST /api/process`: extracts and saves a note, then notifies n8n
- `GET /api/notes`: lists saved notes
- `POST /api/speak`: returns spoken audio

The full request and response formats are in [`docs/API.md`](docs/API.md). Cross-origin access is controlled by an allow list (CORS), so only approved front ends can call the API.

## Run it locally

```bash
npm install
npm run dev
```

Create a `.env.local` file with these variables. It is never committed.

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API |
| `SUPABASE_URL` | Supabase project address |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key, used on the server only |
| `ELEVENLABS_API_KEY` | ElevenLabs text to speech |
| `N8N_WEBHOOK_URL` | n8n webhook |
| `ALLOWED_ORIGINS` | Comma-separated front ends allowed to call the API |

Create the database table by running `supabase/schema.sql` in the Supabase SQL editor.

## What I learned

- Secret keys live only on the server and in a local file that git ignores.
- The server reads keys only when it starts, and Vercel applies new variables only to new deployments. So you restart locally and redeploy online.
- Test and production addresses are different, in n8n and in the front end.
- A one-letter typo in an environment variable name fails silently.
- A 401 or 403 often means a missing permission, not broken code.

## Known limits and next steps

- The app has no login yet, so I plan to add a password gate and rate limits.
- Add user accounts so each person sees only their own notes.
- Try more integrations and compare models for cost and speed.

## Stack

Next.js, TypeScript, Claude API, Supabase, ElevenLabs, n8n, Vercel, Lovable
