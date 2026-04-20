function toLocale(targetLang: string) {
  const lang = (targetLang || "").trim().toLowerCase();
  if (!lang) return null;
  if (lang.startsWith("es")) return "es-ES";
  if (lang.startsWith("en")) return "en-GB";
  if (lang.startsWith("pl")) return "pl-PL";
  if (lang.startsWith("de")) return "de-DE";
  if (lang.startsWith("fr")) return "fr-FR";
  if (lang.startsWith("it")) return "it-IT";
  if (lang.startsWith("pt")) return "pt-PT";
  if (lang.startsWith("ru")) return "ru-RU";
  if (lang.startsWith("tr")) return "tr-TR";
  if (lang.startsWith("ar")) return "ar-SA";
  if (lang.startsWith("sw")) return "sw-KE";
  if (lang.startsWith("zh")) return "zh-CN";
  if (lang.startsWith("ja")) return "ja-JP";
  if (lang.startsWith("ko")) return "ko-KR";
  return null;
}

function firstNonEmpty(...vals: Array<string | null | undefined>) {
  for (const v of vals) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t) return t;
  }
  return null;
}

export function buildTemplateAudioPath(
  targetLang: string,
  kind: "word" | "sentence",
  pairTemplateId?: string | null
) {
  const locale = toLocale(targetLang);
  const templateId = (pairTemplateId || "").trim();
  if (!locale || !templateId) return null;
  return `storage/v1/object/public/tts/${locale}/${kind}/pt-${templateId}.mp3`;
}

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
  pairAudioRaw?: string | null;
  targetLang: string;
  kind: "word" | "sentence";
  pairTemplateId?: string | null;
}) {
  const canonicalRaw = normalizeTemplateAudioKeyToRaw(args.canonicalKey);
  const pairRaw = firstNonEmpty(args.pairAudioRaw);
  const ptFallback = buildTemplateAudioPath(args.targetLang, args.kind, args.pairTemplateId);
  return firstNonEmpty(canonicalRaw, pairRaw, ptFallback);
}

