"use client";

import { useEffect, useRef, useState } from "react";
import type { ExtractResult } from "@/lib/types";
import styles from "./page.module.css";

type Status = "idle" | "loading" | "playing";

// Only one clip plays at a time across the page; starting a new one stops the old one.
let current: { id: symbol; stop: () => void } | null = null;

export default function ListenButton({ result }: { result: ExtractResult }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(Symbol("listen"));

  function cleanup() {
    abortRef.current?.abort();
    abortRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    if (current?.id === idRef.current) current = null;
  }

  function stop() {
    cleanup();
    setStatus("idle");
  }

  // Stop playback if the button unmounts (e.g. the result is replaced).
  useEffect(() => cleanup, []);

  async function play() {
    current?.stop();
    current = { id: idRef.current, stop };
    setError(null);
    setStatus("loading");

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: result.title,
          summary: result.summary,
          action_items: result.action_items,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't generate audio.");
      }

      const url = URL.createObjectURL(await res.blob());
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = stop;
      audio.onerror = () => {
        stop();
        setError("Your browser couldn't play the audio.");
      };
      await audio.play();
      setStatus("playing");
    } catch (err) {
      if (controller.signal.aborted) return; // stopped by the user or another clip
      stop();
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Your browser blocked playback. Click Listen again."
          : err instanceof Error
            ? err.message
            : "Couldn't play audio.",
      );
    }
  }

  const label = status === "loading" ? "Loading…" : status === "playing" ? "■ Stop" : "▶ Listen";

  return (
    <span className={styles.listen}>
      <button
        type="button"
        className={styles.listenButton}
        onClick={status === "idle" ? play : stop}
        aria-label={status === "idle" ? `Listen to ${result.title}` : "Stop audio"}
      >
        {label}
      </button>
      {error && (
        <span className={styles.listenError} role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
