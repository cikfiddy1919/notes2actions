import { buildSpeechText, MAX_SPEECH_CHARS, SpeechError, synthesize } from "@/lib/speech";
import type { ActionItem, ExtractResult } from "@/lib/types";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const result = parseResult(body);
  if (!result) {
    return Response.json({ error: "Nothing to read aloud." }, { status: 400 });
  }

  const text = buildSpeechText(result);
  if (text.length > MAX_SPEECH_CHARS) {
    return Response.json(
      { error: `This note is too long to read aloud (max ${MAX_SPEECH_CHARS.toLocaleString()} characters).` },
      { status: 413 },
    );
  }

  try {
    const audio = await synthesize(text);
    return new Response(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof SpeechError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return Response.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

// Accepts only the fields we read aloud, with the expected types.
function parseResult(body: unknown): ExtractResult | null {
  if (typeof body !== "object" || body === null) return null;
  const { title, summary, action_items } = body as Record<string, unknown>;
  if (typeof title !== "string" || typeof summary !== "string" || !Array.isArray(action_items)) {
    return null;
  }
  if (!title.trim() && !summary.trim()) return null;

  const items: ActionItem[] = [];
  for (const raw of action_items) {
    if (typeof raw !== "object" || raw === null) return null;
    const { task, owner, due } = raw as Record<string, unknown>;
    if (typeof task !== "string") return null;
    items.push({
      task,
      ...(typeof owner === "string" && owner ? { owner } : {}),
      ...(typeof due === "string" && due ? { due } : {}),
    });
  }
  return { title, summary, action_items: items };
}
