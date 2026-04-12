"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type DictionaryResult = {
  pair_id: string;
  deck_id: string;
  word_target: string;
  word_native: string;
  sentence_target: string | null;
  sentence_native: string | null;
  word_target_audio_url: string | null;
  sentence_target_audio_url: string | null;
};

function normalizeQuery(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

export default function DictionaryClient({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();

  // /dictionary/es
  const lang = (pathname?.split("/")[2] || "").trim().toLowerCase();

  const [q, setQ] = useState(() => normalizeQuery(initialQuery || ""));
  const [debounced, setDebounced] = useState(q);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DictionaryResult[]>([]);
  const [total, setTotal] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  // Debounce input
  useEffect(() => {
    const t = setTimeout(() => setDebounced(normalizeQuery(q)), 200);
    return () => clearTimeout(t);
  }, [q]);

  // Fetch results
  useEffect(() => {
    const run = async () => {
      const query = normalizeQuery(debounced);

      if (!lang || query.length < 2) {
        setResults([]);
        setTotal(0);
        setOpenId(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setOpenId(null);

      try {
        // Always request up to 10, then *we* decide to show 1 or 3.
        const url = `/api/dictionary-search?lang=${encodeURIComponent(lang)}&q=${encodeURIComponent(query)}&limit=10`;

        const res = await fetch(url, { credentials: "include", cache: "no-store" });
        if (!res.ok) {
          setResults([]);
          setTotal(0);
          return;
        }

        const data = await res.json();
        if (data?.error) {
          setResults([]);
          setTotal(0);
          return;
        }

        const list: DictionaryResult[] = data.results || [];
        const qn = norm(query);

        // Perfect match = exact match on word_target OR word_native (case-insensitive)
        const perfect = list.filter(
          (r) => norm(r.word_target) === qn || norm(r.word_native) === qn
        );

        // If exactly one perfect match -> show only that one
        if (perfect.length === 1) {
          setResults([perfect[0]]);
          setTotal(1);
          return;
        }

        // Otherwise show only 3 (dictionary feel)
        setResults(list.slice(0, 3));
        setTotal(Math.min(3, list.length));
      } catch {
        setResults([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [debounced, lang]);

  // Audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playAudio = async (url: string | null) => {
    if (!url) return;
    try {
      if (!audioRef.current) audioRef.current = new Audio(url);
      else {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = url;
      }
      await audioRef.current.play();
    } catch {
      // ignore
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ maxWidth: 820, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 650 }}>Dictionary — {(lang || "").toUpperCase()}</div>
          <button
            onClick={() => router.replace("/decks")}
            style={{
              border: "1px solid #222",
              background: "#fff",
              color: "#111",
              borderRadius: 12,
              padding: "10px 12px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Back to decks
          </button>
        </div>

        <div style={{ border: "1px solid #222", borderRadius: 16, padding: 14, display: "grid", gap: 8 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search mastered… (min 2 chars)"
            style={{
              border: "1px solid #222",
              borderRadius: 12,
              padding: "12px 14px",
              outline: "none",
              fontSize: 16,
            }}
          />
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Click a row to see the example sentence.
          </div>
        </div>

        <div style={{ fontSize: 13, opacity: 0.85 }}>
          {loading ? "Searching…" : debounced.length >= 2 ? `${results.length} shown` : ""}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {results.map((r) => {
            const isOpen = openId === r.pair_id;

            return (
              <div key={r.pair_id} style={{ border: "1px solid #222", borderRadius: 16, padding: 14 }}>
                <div
                  onClick={() => setOpenId(isOpen ? null : r.pair_id)}
                  style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", cursor: "pointer" }}
                  title="Click to show sentence"
                >
                  <div style={{ fontSize: 18, fontWeight: 650 }}>{r.word_target}</div>
                  <div style={{ opacity: 0.5 }}>—</div>
                  <div style={{ fontSize: 18 }}>{r.word_native}</div>

                  <div style={{ flex: 1 }} />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void playAudio(r.word_target_audio_url);
                    }}
                    disabled={!r.word_target_audio_url}
                    style={{
                      border: "1px solid #222",
                      background: "#fff",
                      color: "#111",
                      borderRadius: 12,
                      padding: "8px 10px",
                      cursor: r.word_target_audio_url ? "pointer" : "not-allowed",
                      opacity: r.word_target_audio_url ? 1 : 0.35,
                      fontSize: 13,
                    }}
                  >
                    Play audio
                  </button>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                    <div style={{ borderTop: "1px solid #222", paddingTop: 10 }} />
                    <div style={{ fontSize: 14, fontWeight: 650 }}>{r.sentence_target || "—"}</div>
                    <div style={{ fontSize: 14, opacity: 0.85 }}>{r.sentence_native || "—"}</div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => void playAudio(r.sentence_target_audio_url)}
                        disabled={!r.sentence_target_audio_url}
                        style={{
                          border: "1px solid #222",
                          background: "#fff",
                          color: "#111",
                          borderRadius: 12,
                          padding: "8px 10px",
                          cursor: r.sentence_target_audio_url ? "pointer" : "not-allowed",
                          opacity: r.sentence_target_audio_url ? 1 : 0.35,
                          fontSize: 13,
                        }}
                      >
                        Play audio
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {!loading && debounced.length >= 2 && results.length === 0 && (
            <div style={{ border: "1px solid #222", borderRadius: 16, padding: 14, opacity: 0.8 }}>
              No mastered matches found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
