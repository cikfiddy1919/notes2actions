import { connection } from "next/server";
import { listNotes } from "@/lib/notes";
import type { NotesResponse } from "@/lib/types";

export async function GET() {
  // Always run at request time; never prerender this response at build.
  await connection();

  try {
    const notes = await listNotes();
    const body: NotesResponse = { configured: notes !== null, notes: notes ?? [] };
    return Response.json(body);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Could not load saved notes." }, { status: 500 });
  }
}
