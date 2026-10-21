import "server-only"; // build fails if this module is ever imported into client code

import Anthropic from "@anthropic-ai/sdk";
import type { ActionItem, ExtractResult } from "./types";

const MODEL = "claude-sonnet-5-5";
const TOOL_NAME = "record_actions";

// Reads ANTHROPIC_API_KEY from process.env (Next.js loads .env.local on the server).
const client = new Anthropic();

const recordActionsTool: Anthropic.Beta.BetaTool = {
  name: TOOL_NAME,
  description:
    "Record the structured result of analysing meeting notes: a short title, a summary, and every action item.",
  // strict: the arguments are guaranteed to validate against this schema.
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short title for the meeting (max ~8 words)." },
      summary: { type: "string", description: "2-4 sentence summary of what was discussed and decided." },
      action_items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            task: { type: "string", description: "The concrete action, starting with a verb." },
            owner: {
              type: ["string", "null"],
              description: "Person responsible, if stated or clearly implied; otherwise null.",
            },
            due: {
              type: ["string", "null"],
              description: "Deadline exactly as stated in the notes (e.g. 'Friday', '2026-11-03'); otherwise null.",
            },
          },
          required: ["task", "owner", "due"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "summary", "action_items"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You turn messy meeting notes into a clean record.
Always respond by calling the ${TOOL_NAME} tool exactly once; do not reply with plain text.
Only include owners and due dates that the notes actually state or clearly imply — never invent them.
If there are no action items, return an empty list.`;

type RawInput = {
  title: string;
  summary: string;
  action_items: { task: string; owner: string | null; due: string | null }[];
};

export class ExtractionError extends Error {}

export async function extractActions(notes: string): Promise<ExtractResult> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `<notes>\n${notes}\n</notes>` },
  ];

  // claude-sonnet-5-5 rejects forced tool_choice ("tool"/"any") with a 400, so we use
  // "auto" + a strict tool + a system instruction, and retry once if no tool call comes back.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      tools: [recordActionsTool],
      tool_choice: { type: "auto", disable_parallel_tool_use: true },
      messages,
      // If a safety classifier declines, the API re-runs the request on a suitable fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    if (response.stop_reason === "refusal") {
      throw new ExtractionError("The model declined to process these notes.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new ExtractionError("The notes were too long to process in one response.");
    }

    const toolUse = response.content.find(
      (block): block is Anthropic.Beta.BetaToolUseBlock =>
        block.type === "tool_use" && block.name === TOOL_NAME,
    );
    if (toolUse) {
      return normalize(toolUse.input as RawInput);
    }

    // No tool call: append the reply and nudge it to use the tool.
    messages.push(
      { role: "assistant", content: response.content },
      { role: "user", content: `Please call the ${TOOL_NAME} tool with the result.` },
    );
  }

  throw new ExtractionError("The model did not return structured output. Please try again.");
}

// Convert nulls from the strict schema into omitted optional fields.
function normalize(input: RawInput): ExtractResult {
  return {
    title: input.title,
    summary: input.summary,
    action_items: input.action_items.map((item) => {
      const out: ActionItem = { task: item.task };
      if (item.owner) out.owner = item.owner;
      if (item.due) out.due = item.due;
      return out;
    }),
  };
}
