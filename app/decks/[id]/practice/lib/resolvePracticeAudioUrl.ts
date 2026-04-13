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

  const cleanTtsKey = path.replace(/^tts\//, "");
  if (!cleanTtsKey) return "";

  return `${base}/storage/v1/object/public/tts/${cleanTtsKey}`;
}
