// Shared between the API route (server) and the page (client).
// Contains only types — no secrets, no SDK imports.

export interface ActionItem {
  task: string;
  owner?: string;
  due?: string;
}

export interface ExtractResult {
  title: string;
  summary: string;
  action_items: ActionItem[];
}

// A row in the Supabase `notes` table.
export interface SavedNote extends ExtractResult {
  id: string;
  created_at: string;
  raw_text: string;
}

// POST /api/process response. `saved` is false when Supabase isn't configured or the insert failed.
export interface ProcessResponse extends ExtractResult {
  saved: boolean;
}

// GET /api/notes response. `configured` is false when Supabase env vars are missing.
export interface NotesResponse {
  configured: boolean;
  notes: SavedNote[];
}
