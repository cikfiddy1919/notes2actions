"use client";

import { useCallback, useEffect, useState } from "react";
import type { ActionItem, NotesResponse, ProcessResponse, SavedNote } from "@/lib/types";
import ListenButton from "./ListenButton";
import styles from "./page.module.css";

function ActionList({ items }: { items: ActionItem[] }) {
  if (items.length === 0) return <p className={styles.muted}>No action items found.</p>;
  return (
    <ul className={styles.list}>
      {items.map((item, i) => (
        <li key={i} className={styles.item}>
          <span>{item.task}</span>
          <span className={styles.meta}>
            {item.owner && <span className={styles.tag}>👤 {item.owner}</span>}
            {item.due && <span className={styles.tag}>📅 {item.due}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

async function fetchHistory(): Promise<NotesResponse> {
  const res = await fetch("/api/notes", { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not load saved notes.");
  return data as NotesResponse;
}

export default function Home() {
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // null = still loading; configured=false = Supabase not set up.
  const [history, setHistory] = useState<NotesResponse | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const applyHistory = useCallback((p: Promise<NotesResponse>) => {
    p.then(
      (data) => {
        setHistory(data);
        setHistoryError(null);
      },
      (err) => setHistoryError(err instanceof Error ? err.message : "Could not load saved notes."),
    );
  }, []);

  useEffect(() => {
    applyHistory(fetchHistory());
  }, [applyHistory]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      setResult(data as ProcessResponse);
      if (data.saved) applyHistory(fetchHistory());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>Notes2Actions</h1>
      <p className={styles.lede}>Paste messy meeting notes and get a summary with action items.</p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <textarea
          className={styles.textarea}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. sync w/ design - Sam to send mockups by Fri, need budget sign-off from Priya…"
          rows={12}
        />
        <button className={styles.button} type="submit" disabled={loading || !notes.trim()}>
          {loading ? "Extracting…" : "Extract actions"}
        </button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {result && (
        <section className={styles.result}>
          <div className={styles.noteHeader}>
            <h2>{result.title}</h2>
            <ListenButton result={result} />
          </div>
          <p>{result.summary}</p>
          <h3>Action items</h3>
          <ActionList items={result.action_items} />
          {!result.saved && history?.configured && (
            <p className={styles.muted}>This result couldn&apos;t be saved.</p>
          )}
        </section>
      )}

      <section className={styles.history}>
        <h2>Saved notes</h2>
        {historyError ? (
          <p className={styles.error}>{historyError}</p>
        ) : history === null ? (
          <p className={styles.muted}>Loading…</p>
        ) : !history.configured ? (
          <p className={styles.muted}>Saving is off — Supabase isn&apos;t configured.</p>
        ) : history.notes.length === 0 ? (
          <p className={styles.muted}>No saved notes yet.</p>
        ) : (
          history.notes.map((note: SavedNote) => (
            <article key={note.id} className={styles.note}>
              <header className={styles.noteHeader}>
                <h3>{note.title}</h3>
                <time className={styles.muted} dateTime={note.created_at}>
                  {new Date(note.created_at).toLocaleString()}
                </time>
              </header>
              <p>{note.summary}</p>
              <ActionList items={note.action_items} />
              <ListenButton result={note} />
              <details>
                <summary className={styles.muted}>Original notes</summary>
                <pre className={styles.raw}>{note.raw_text}</pre>
              </details>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
