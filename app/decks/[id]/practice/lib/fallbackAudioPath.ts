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
