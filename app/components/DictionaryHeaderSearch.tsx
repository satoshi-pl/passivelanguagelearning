"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { trackGaEvent } from "@/lib/analytics/ga";
import { resolveBrowserAudioUrl } from "@/lib/audio/resolveBrowserAudioUrl";

type Result = {
  pair_id: string;
  deck_id: string;
  word_target: string;
  word_native: string;
  sentence_target: string | null;
  sentence_native: string | null;
  word_target_audio_url: string | null;
  sentence_target_audio_url: string | null;
};

function cleanLang(s: string) {
  return (s || "").trim().toLowerCase();
}

function normalizeQuery(s: string) {
  return (s || "").trim().replace(/\s+/g, " ");
}

function fold(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

type DictionaryLayout = "default" | "panel";
const SUPABASE_PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export default function DictionaryHeaderSearch({
  langs,
  layout = "default",
  onRequestClose,
}: {
  langs: string[];
  layout?: DictionaryLayout;
  onRequestClose?: () => void;
}) {
  const pathname = usePathname();

  const available = useMemo(() => {
    return Array.from(new Set((langs || []).map(cleanLang).filter(Boolean)));
  }, [langs]);

  const defaultLang = available[0] || "es";

  const urlLang = useMemo(() => {
    const m = pathname?.match(/^\/dictionary\/([^/]+)/);
    return m?.[1] ? cleanLang(m[1]) : null;
  }, [pathname]);

  const [lang, setLang] = useState<string>(urlLang || defaultLang);
  const [langOpen, setLangOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTrackedSearchRef = useRef("");

  const playAudio = async (url: string | null) => {
    const resolvedUrl = resolveBrowserAudioUrl(url, SUPABASE_PUBLIC_URL);
    if (!resolvedUrl) return;

    try {
      if (!audioRef.current) audioRef.current = new Audio(resolvedUrl);
      else {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = resolvedUrl;
      }

      await audioRef.current.play();
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setLangOpen(false);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setLangOpen(false);
      }
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(normalizeQuery(q)), 180);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const run = async () => {
      const query = normalizeQuery(debounced);

      if (query.length < 2) {
        setResults([]);
        setLoading(false);
        setExpandedId(null);
        setOpen(false);
        return;
      }

      setLoading(true);
      setOpen(true);
      setExpandedId(null);

      try {
        const effectiveLang = cleanLang(lang) || defaultLang;
        const searchKey = `${effectiveLang}:${query}`;
        if (lastTrackedSearchRef.current !== searchKey) {
          trackGaEvent("search", {
            search_term: query,
            search_context: "dictionary",
          });
          lastTrackedSearchRef.current = searchKey;
        }
        const url = `/api/dictionary-search?lang=${encodeURIComponent(
          effectiveLang
        )}&q=${encodeURIComponent(query)}`;

        const res = await fetch(url, {
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          setResults([]);
          return;
        }

        const data = await res.json();
        if (data?.error) {
          setResults([]);
          return;
        }

        const top = (data.results || []) as Result[];
        const qFold = fold(query);

        const perfect =
          query.length >= 4
            ? top.find((r) => {
                const wt = fold(r.word_target);
                const wn = fold(r.word_native);
                return wt === qFold || wn === qFold;
              })
            : undefined;

        if (perfect) setResults([perfect]);
        else setResults(top.slice(0, Math.min(3, top.length)));
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [debounced, lang, defaultLang]);

  const showLangDropdown = available.length >= 2;

  const isPanel = layout === "panel";

  return (
    <div ref={wrapRef} className="relative w-full min-w-0 md:w-auto">
      {isPanel && onRequestClose ? (
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <span className="text-xs font-semibold text-[var(--foreground)]">Dictionary</span>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setLangOpen(false);
              onRequestClose();
            }}
            className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
            aria-label="Close dictionary"
          >
            Close
          </button>
        </div>
      ) : null}

      {!isPanel ? (
        <div className="mb-1 px-1 md:hidden">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
            Mastered words dictionary
          </span>
        </div>
      ) : null}

      <div
        className={
          isPanel
            ? "flex min-w-0 items-center rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1 shadow-sm md:min-w-[260px]"
            : "flex min-w-0 items-center rounded-2xl border border-neutral-200 bg-white px-2.5 py-1.5 shadow-[0_1px_0_rgba(0,0,0,0.04)] md:min-w-[260px]"
        }
      >
        {showLangDropdown && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                isPanel
                  ? "bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[var(--surface-solid)]"
                  : "bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
              }`}
              title="Target language"
            >
              {cleanLang(lang).toUpperCase()}
            </button>

            {langOpen && (
              <div
                className={`absolute left-0 top-[calc(100%+8px)] z-50 min-w-[120px] rounded-2xl border p-2 shadow-lg ${
                  isPanel
                    ? "border-[var(--border)] bg-[var(--surface-solid)]"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <div className="grid gap-1">
                  {available.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => {
                        setLang(l);
                        setLangOpen(false);
                      }}
                      className="rounded-xl px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100"
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => {
            if (normalizeQuery(q).length >= 2) setOpen(true);
          }}
          placeholder="Search dictionary"
          className={`w-full min-w-0 bg-transparent px-3 py-2.5 text-sm outline-none md:w-[220px] md:py-2 lg:w-[320px] xl:w-[400px] ${
            isPanel
              ? "text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]"
              : "text-neutral-900 placeholder:text-neutral-400"
          }`}
        />
      </div>

      {open && normalizeQuery(q).length >= 2 && (
        <div
          className={`absolute left-0 right-0 top-[calc(100%+8px)] z-50 w-full max-h-[min(50vh,22rem)] overflow-y-auto rounded-2xl border p-2 shadow-lg md:left-auto md:right-0 md:max-h-none md:w-[520px] md:max-w-[90vw] ${
            isPanel
              ? "border-[var(--border)] bg-[var(--surface-solid)]"
              : "border-neutral-200 bg-white"
          }`}
        >
          {loading ? (
            <div className="px-3 py-2 text-sm text-neutral-500">Searching...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-neutral-500">
              No mastered matches.
            </div>
          ) : (
            <div className="grid gap-1">
              {results.map((r) => {
                const expanded = expandedId === r.pair_id;

                return (
                  <div
                    key={r.pair_id}
                    className="overflow-hidden rounded-2xl border border-neutral-200"
                  >
                    <div
                      className="flex items-center gap-3 px-3 py-2 hover:bg-neutral-50"
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedId(expanded ? null : r.pair_id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setExpandedId(expanded ? null : r.pair_id);
                        }
                      }}
                      title="Click to show sentence"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-baseline gap-2">
                          <div className="truncate text-sm font-semibold text-neutral-900">
                            {r.word_target}
                          </div>
                          <div className="text-sm text-neutral-400">-</div>
                          <div className="truncate text-sm text-neutral-800">
                            {r.word_native}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void playAudio(r.word_target_audio_url);
                        }}
                        disabled={!r.word_target_audio_url}
                        className={`rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-100 ${
                          r.word_target_audio_url
                            ? "text-neutral-700"
                            : "cursor-not-allowed text-neutral-400"
                        }`}
                      >
                        Play audio
                      </button>
                    </div>

                    {expanded && (
                      <div className="bg-white px-3 pb-3 pt-2">
                        <div className="grid gap-2 border-t border-neutral-200 pt-3">
                          <div className="text-sm font-semibold text-neutral-900">
                            {r.sentence_target || "-"}
                          </div>
                          <div className="text-sm text-neutral-700">
                            {r.sentence_native || "-"}
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                void playAudio(r.sentence_target_audio_url)
                              }
                              disabled={!r.sentence_target_audio_url}
                              className={`rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-100 ${
                                r.sentence_target_audio_url
                                  ? "text-neutral-700"
                                  : "cursor-not-allowed text-neutral-400"
                              }`}
                            >
                              Play audio
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
