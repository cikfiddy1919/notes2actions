import Anthropic from "@anthropic-ai/sdk";
import { extractActions, ExtractionError } from "@/lib/extract";
import { saveNote } from "@/lib/notes";
import type { ProcessResponse } from "@/lib/types";

const MAX_NOTES_CHARS = 100_000;

export async function POST(request: Request) {
  let notes: unknown;
  try {
    ({ notes } = await request.json());
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  if (typeof notes !== "string" || notes.trim().length === 0) {
    return Response.json({ error: "Please paste some meeting notes." }, { status: 400 });
  }
  if (notes.length > MAX_NOTES_CHARS) {
    return Response.json(
      { error: `Notes are too long (max ${MAX_NOTES_CHARS.toLocaleString()} characters).` },
      { status: 413 },
    );
  }

  try {
    const result = await extractActions(notes);

    // Saving is best-effort: a missing config or DB error never blocks the result.
    let saved = false;
    try {
      saved = (await saveNote(notes, result)) !== null;
    } catch (dbErr) {
      console.error(dbErr);
    }

    const body: ProcessResponse = { ...result, saved };
    return Response.json(body);
  } catch (err) {
    if (err instanceof ExtractionError) {
      return Response.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic auth error — check ANTHROPIC_API_KEY in .env.local");
      return Response.json({ error: "Server is not configured correctly." }, { status: 500 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Rate limited — please try again shortly." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error:", err.status, err.message);
      return Response.json({ error: "Upstream AI service error." }, { status: 502 });
    }
    console.error(err);
    return Response.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
