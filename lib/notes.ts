import "server-only";

import { getSupabase } from "./supabase";
import type { ExtractResult, SavedNote } from "./types";

const TABLE = "notes";
const COLUMNS = "id, created_at, raw_text, title, summary, action_items";

// Returns the saved row, or null if Supabase isn't configured. Throws on database errors.
export async function saveNote(rawText: string, result: ExtractResult): Promise<SavedNote | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      raw_text: rawText,
      title: result.title,
      summary: result.summary,
      action_items: result.action_items,
    })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  return data as SavedNote;
}

// Returns notes newest first, or null if Supabase isn't configured. Throws on database errors.
export async function listNotes(limit = 50): Promise<SavedNote[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Supabase select failed: ${error.message}`);
  return data as SavedNote[];
}
