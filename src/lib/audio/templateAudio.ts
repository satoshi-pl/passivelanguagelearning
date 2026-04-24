export function normalizeTemplateAudioKeyToRaw(key?: string | null) {
  const raw = (key || "").trim();
  if (!raw) return null;

  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  const path = raw.replace(/^\/+/, "");

  if (path.startsWith("storage/v1/")) return path;
  if (path.startsWith("object/")) return `storage/v1/${path}`;

  const ttsIdx = path.indexOf("tts/");
  if (ttsIdx >= 0) {
    const afterTts = path.slice(ttsIdx + "tts/".length).trim();
    if (!afterTts) return null;
    return `storage/v1/object/public/tts/${afterTts}`;
  }

  return `storage/v1/object/public/tts/${path}`;
}

export function resolvePreferredAudioRaw(args: {
  canonicalKey?: string | null;
}) {
  return normalizeTemplateAudioKeyToRaw(args.canonicalKey);
}

