"use client";

import { useEffect, useRef, useState } from "react";

type ResolveAudioUrl = (raw?: string | null) => string;

type PlayAllOptions<T> = {
  getRaw: (row: T) => string | null | undefined;
  onRowStart?: (row: T) => void;
  onDone?: () => void;
  gapMs?: number;
  ensureAudible?: boolean;
};

export function useAudioController(resolveAudioUrl: ResolveAudioUrl, debugAudio = false) {
  const dlog = (...args: unknown[]) => {
    if (!debugAudio) return;
    console.debug("[audio-debug]", ...args);
  };
  const [enabled, setEnabled] = useState(true);
  const [muted, setMutedState] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const enabledRef = useRef(true);
  const mutedRef = useRef(false);
  const playbackRateRef = useRef(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sequence guards:
  // - playSeqRef: cancels/invalidates in-flight play() / playAndWaitEnded()
  // - playAllSeqRef: cancels/invalidates in-flight playAll() loop
  const playSeqRef = useRef(0);
  const playAllSeqRef = useRef(0);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    mutedRef.current = muted;
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    const el = audioRef.current;
    if (!el) return;
    el.defaultPlaybackRate = playbackRate;
    el.playbackRate = playbackRate;
  }, [playbackRate]);

  const applyPlaybackRate = (el: HTMLAudioElement, rate: number) => {
    el.defaultPlaybackRate = rate;
    el.playbackRate = rate;
  };

  const enable = () => {
    enabledRef.current = true;
    setEnabled(true);
  };

  const setMuted = (next: boolean) => {
    mutedRef.current = next;
    setMutedState(next);

    const el = audioRef.current;
    if (el) el.muted = next;

    // Any mute change should invalidate in-flight playback expectations
    playSeqRef.current++;
  };

  const toggleMute = () => setMuted(!mutedRef.current);
  const setPlaybackRate = (next: number) => {
    const safe = next === 0.75 ? 0.75 : 1;
    playbackRateRef.current = safe;
    setPlaybackRateState(safe);

    const el = audioRef.current;
    if (el) applyPlaybackRate(el, safe);
  };

  const togglePlaybackRate = () => {
    setPlaybackRate(playbackRateRef.current === 0.75 ? 1 : 0.75);
  };

  const stop = () => {
    // Cancel both single play and playAll
    playAllSeqRef.current++;
    playSeqRef.current++;

    try {
      const el = audioRef.current;
      if (!el) return;

      el.pause();
      el.currentTime = 0;

      // Recommended: fully clear src to force abort/ended paths cleanly
      el.removeAttribute("src");
      el.load();
    } catch {
      // ignore
    }
  };

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  /**
   * Plays audio (fire-and-forget: resolves when playback starts or fails).
   * This is ideal for "play current prompt" UX (you don't want to block UI until it ends).
   */
  const play = async (raw?: string | null) => {
    const url = resolveAudioUrl(raw);
    dlog("play() called", {
      path: "single",
      rawAudio: raw ?? null,
      resolvedUrl: url || null,
      enabled: enabledRef.current,
      muted: mutedRef.current,
    });
    if (!url) {
      dlog("play() exit: missing URL");
      return;
    }
    if (!enabledRef.current) {
      dlog("play() exit: audio disabled");
      return;
    }
    if (mutedRef.current) {
      dlog("play() exit: muted");
      return;
    }

    const el = audioRef.current;
    if (!el) {
      dlog("play() exit: no audio element ref");
      return;
    }
    dlog("audio element present (single)", {
      readyState: el.readyState,
      networkState: el.networkState,
    });

    const mySeq = ++playSeqRef.current;

    try {
      el.pause();
      el.currentTime = 0;

      el.src = url;
      el.preload = "auto";
      el.muted = mutedRef.current;
      applyPlaybackRate(el, playbackRateRef.current);
      el.load();
      await new Promise<void>((resolve) => {
        const syncRate = () => {
          dlog("loadedmetadata", { readyState: el.readyState, src: el.currentSrc || el.src });
          applyPlaybackRate(el, playbackRateRef.current);
          resolve();
        };
        const onCanPlay = () => dlog("canplay", { path: "single", readyState: el.readyState });
        const onCanPlayThrough = () =>
          dlog("canplaythrough", { path: "single", readyState: el.readyState });
        const onError = () => dlog("audio error event", { error: el.error?.message ?? null });
        el.addEventListener("canplay", onCanPlay, { once: true });
        el.addEventListener("canplaythrough", onCanPlayThrough, { once: true });
        el.addEventListener("error", onError, { once: true });
        el.addEventListener("loadedmetadata", syncRate, { once: true });
        if (el.readyState >= 1) syncRate();
      });

      dlog("calling HTMLAudioElement.play()");
      await el.play();
      dlog("play() resolved");

      // If something else started/stopped since we began, just bail quietly
      if (mySeq !== playSeqRef.current) return;
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : undefined;
      dlog("play() rejected", {
        name: err instanceof Error ? err.name : String(name ?? "UnknownError"),
        message: err instanceof Error ? err.message : String(err),
      });
      if (name === "AbortError" || name === "NotAllowedError") return;
      console.error("[AUDIO] play() failed:", err);
    }
  };

  /**
   * Internal: wait until the element ends or errors/aborts,
   * but do not hang if the sequence changed (cancel/stop/mute/etc).
   */
  const waitForEndOrCancel = (el: HTMLAudioElement, seqAtStart: number) =>
    new Promise<void>((resolve) => {
      const done = () => {
        el.removeEventListener("ended", done);
        el.removeEventListener("error", done);
        el.removeEventListener("abort", done);
        resolve();
      };

      // If cancelled before we even attach, resolve immediately
      if (seqAtStart !== playSeqRef.current) return resolve();

      el.addEventListener("ended", done);
      el.addEventListener("error", done);
      el.addEventListener("abort", done);
    });

  /**
   * Plays audio and resolves only when playback has finished (ended),
   * or is interrupted (abort/error/stop/cancel/mute sequence change).
   * This is the correct primitive for "play all" sequencing.
   */
  const playAndWaitEnded = async (raw?: string | null) => {
    const url = resolveAudioUrl(raw);
    dlog("playAndWaitEnded() called", {
      path: "playAll",
      rawAudio: raw ?? null,
      resolvedUrl: url || null,
      enabled: enabledRef.current,
      muted: mutedRef.current,
    });
    if (!url) return;
    if (!enabledRef.current) return;
    if (mutedRef.current) return;

    const el = audioRef.current;
    if (!el) return;

    const mySeq = ++playSeqRef.current;

    try {
      el.pause();
      el.currentTime = 0;

      el.src = url;
      el.preload = "auto";
      el.muted = mutedRef.current;
      applyPlaybackRate(el, playbackRateRef.current);
      el.load();
      await new Promise<void>((resolve) => {
        const syncRate = () => {
          dlog("loadedmetadata", {
            path: "playAll",
            readyState: el.readyState,
            src: el.currentSrc || el.src,
          });
          applyPlaybackRate(el, playbackRateRef.current);
          resolve();
        };
        const onCanPlay = () => dlog("canplay", { path: "playAll", readyState: el.readyState });
        const onCanPlayThrough = () =>
          dlog("canplaythrough", { path: "playAll", readyState: el.readyState });
        const onError = () =>
          dlog("audio error event", {
            path: "playAll",
            code: el.error?.code ?? null,
            message: el.error?.message ?? null,
          });
        el.addEventListener("canplay", onCanPlay, { once: true });
        el.addEventListener("canplaythrough", onCanPlayThrough, { once: true });
        el.addEventListener("error", onError, { once: true });
        el.addEventListener("loadedmetadata", syncRate, { once: true });
        if (el.readyState >= 1) syncRate();
      });

      await el.play();
      dlog("playAndWaitEnded() play resolved");

      // ✅ The key fix: wait for real end before continuing the sequence
      await waitForEndOrCancel(el, mySeq);
      dlog("playAndWaitEnded() completed");
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : undefined;
      dlog("playAndWaitEnded() rejected", {
        name: err instanceof Error ? err.name : String(name ?? "UnknownError"),
        message: err instanceof Error ? err.message : String(err),
      });
      if (name === "AbortError" || name === "NotAllowedError") return;
      console.error("[AUDIO] playAndWaitEnded() failed:", err);
    }
  };

  const playAll = async <T,>(rows: T[], opts: PlayAllOptions<T>) => {
    if (!rows.length) return;

    const { getRaw, onRowStart, onDone, gapMs = 700, ensureAudible = false } = opts;

    if (ensureAudible) {
      enable();
      setMuted(false);
    }

    const seq = ++playAllSeqRef.current;
    dlog("playAll() called", { path: "playAll", count: rows.length, seq });

    try {
      for (const [idx, row] of rows.entries()) {
        if (seq !== playAllSeqRef.current) return;

        const raw = getRaw(row);
        const url = resolveAudioUrl(raw);
        dlog("playAll row", { index: idx, rawAudio: raw ?? null, resolvedUrl: url || null });
        if (!url) continue;

        onRowStart?.(row);

        // ✅ Critical: wait until the current audio finishes (ended)
        await playAndWaitEnded(raw);

        if (seq !== playAllSeqRef.current) return;
        if (gapMs > 0) await sleep(gapMs);
      }
    } finally {
      // Only call onDone if this run wasn't cancelled
      if (seq === playAllSeqRef.current) {
        dlog("playAll() completed", { seq });
        onDone?.();
      } else {
        dlog("playAll() cancelled", { seq });
      }
    }
  };

  return {
    audioRef,
    enabled,
    muted,
    playbackRate,
    setPlaybackRate,
    togglePlaybackRate,
    enable,
    setMuted,
    toggleMute,
    stop,
    play,
    playAll,
    cancelPlayAll: () => {
      playAllSeqRef.current++;
    },
  };
}
