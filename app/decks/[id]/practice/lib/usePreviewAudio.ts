"use client";

import { useCallback, useState } from "react";
import type { PairRow } from "./types";

// Type only what we actually need from your audio controller
type AudioLike = {
  enable(): void;
  stop(): void;
  setMuted(v: boolean): void;
  play(raw?: string | null): Promise<void> | void;
  playAll(
    rows: PairRow[],
    opts: {
      getRaw: (p: PairRow) => string | null | undefined;
      onRowStart?: (p: PairRow) => void;
      onDone?: () => void;
      gapMs?: number;
      ensureAudible?: boolean;
    }
  ): Promise<void>;
};

export function usePreviewAudio(audio: AudioLike, debugAudio = false) {
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  const [playAllBusy, setPlayAllBusy] = useState(false);

  const resetPreviewAudioState = useCallback(() => {
    setSelectedPreviewId(null);
    setPlayingPreviewId(null);
    setPlayAllBusy(false);
  }, []);

  const getPreviewAudioRaw = useCallback((p: PairRow) => {
    return p.word_target_audio_url ?? p.sentence_target_audio_url ?? null;
  }, []);

  const onPreviewRowPlay = useCallback(
    (p: PairRow) => {
      const rawAudio = getPreviewAudioRaw(p);
      if (debugAudio) {
        console.debug("[audio-debug]", "preview single-play handler fired", {
          pairId: p.id,
          rawAudio,
        });
      }
      setSelectedPreviewId(p.id);
      setPlayingPreviewId(p.id);

      audio.enable();
      audio.setMuted(false);
      void audio.play(rawAudio);
    },
    [audio, debugAudio, getPreviewAudioRaw]
  );

const playAllPreviewWords = useCallback(
  async (rows: PairRow[]) => {
    if (debugAudio) {
      console.debug("[audio-debug]", "preview play-all handler fired", { count: rows.length });
    }
    if (!rows.length) return;

    setPlayAllBusy(true);
    setPlayingPreviewId(null);
    setSelectedPreviewId(null);

    try {
      await audio.playAll(rows, {
        getRaw: getPreviewAudioRaw,
        onRowStart: (p) => setPlayingPreviewId(p.id),
        gapMs: 700,
        ensureAudible: true,
      });
    } finally {
      setPlayAllBusy(false);
      setPlayingPreviewId(null);
    }
  },
  [audio, debugAudio, getPreviewAudioRaw]
);

  return {
    selectedPreviewId,
    setSelectedPreviewId,
    playingPreviewId,
    setPlayingPreviewId,
    playAllBusy,
    resetPreviewAudioState,
    onPreviewRowPlay,
    playAllPreviewWords,
  };
}
