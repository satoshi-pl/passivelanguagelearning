/**
 * Turn a DB-stored audio reference into a URL the browser can load.
 * PLL historically stored `tts/...` keys; some exports use full https URLs or
 * `storage/v1/...` paths relative to the project host.
 */
export function resolvePracticeAudioUrl(
  raw?: string | null,
  supabasePublicUrl?: string | null
): string {
  const v = (raw ?? "").trim();
  if (!v) return "";

  if (v.startsWith("http://") || v.startsWith("https://")) {
    return v;
  }

  const base = (supabasePublicUrl ?? "").trim().replace(/\/$/, "");
  if (!base) return "";

  const path = v.replace(/^\/+/, "");

  if (path.startsWith("storage/v1/")) {
    return `${base}/${path}`;
  }

  // Some exports / older backfills store `object/public/...` without the `storage/v1/` prefix.
  if (path.startsWith("object/")) {
    return `${base}/storage/v1/${path}`;
  }

  // If we can spot a `tts/` segment anywhere, treat everything after it as the object key.
  // This makes audio resilient to variants like `public/tts/...` or `object/public/tts/...`.
  const ttsIdx = path.indexOf("tts/");
  if (ttsIdx >= 0) {
    const key = path.slice(ttsIdx + "tts/".length);
    if (key) return `${base}/storage/v1/object/public/tts/${key}`;
  }

  const cleanTtsKey = path.replace(/^tts\//, "");
  if (!cleanTtsKey) return "";

  return `${base}/storage/v1/object/public/tts/${cleanTtsKey}`;
}
