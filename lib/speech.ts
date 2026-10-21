import "server-only"; // build fails if this module is ever imported into client code

import type { ExtractResult } from "./types";

const API_BASE = "https://api.elevenlabs.io/v1/text-to-speech";
const MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // "George", an ElevenLabs premade voice
const OUTPUT_FORMAT = "mp3_44100_128";

// Caps credit spend per click; well under the model's own per-request limit.
export const MAX_SPEECH_CHARS = 3000;

// Error with a message that is safe to show in the browser.
export class SpeechError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Turns a result into a natural script: title, summary, then numbered action items.
export function buildSpeechText({ title, summary, action_items }: ExtractResult): string {
  const parts = [`${title}.`, summary];
  if (action_items.length === 0) {
    parts.push("There are no action items.");
  } else {
    parts.push(action_items.length === 1 ? "There is one action item." : `There are ${action_items.length} action items.`);
    action_items.forEach((item, i) => {
      let line = `${i + 1}. ${item.task}`;
      if (item.owner) line += `. Owner: ${item.owner}`;
      if (item.due) line += `. Due: ${item.due}`;
      parts.push(`${line}.`);
    });
  }
  // Avoid doubled punctuation like "Friday.." from model output.
  return parts.join("\n").replace(/([.!?])\.+/g, "$1");
}

export async function synthesize(text: string): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new SpeechError("Listening isn't set up on this server.", 503);

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const url = `${API_BASE}/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: MODEL_ID }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    console.error("ElevenLabs request failed:", err);
    throw new SpeechError("Couldn't reach the voice service. Please try again.", 502);
  }

  if (res.ok) return res.arrayBuffer();

  // Log the upstream detail server-side; return a friendly message to the browser.
  const detail = await res.text().catch(() => "");
  console.error(`ElevenLabs error ${res.status}: ${detail.slice(0, 500)}`);

  if (detail.includes("quota_exceeded")) {
    throw new SpeechError("The voice service is out of credits for now.", 503);
  }
  switch (res.status) {
    case 401:
    case 403:
      throw new SpeechError("Listening isn't set up correctly on this server.", 503);
    case 404:
      throw new SpeechError("The configured voice wasn't found.", 503);
    case 429:
      throw new SpeechError("The voice service is busy. Please try again in a moment.", 429);
    default:
      throw new SpeechError("The voice service had a problem. Please try again.", 502);
  }
}
