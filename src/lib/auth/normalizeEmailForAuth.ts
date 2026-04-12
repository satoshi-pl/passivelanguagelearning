/**
 * Prepare email for Supabase Auth (signUp / signInWithPassword).
 * Conservative cleanup: whitespace, invisible/format chars, wrapping quotes — does not alter valid ASCII email structure.
 */
export function normalizeEmailForAuth(raw: string): string {
  let s = raw.normalize("NFC");

  // CR / LF / tab / other ASCII vertical whitespace sometimes pasted or injected
  s = s.replace(/[\r\n\t\u000B\u000C]/g, "");

  // Zero-width, BOM, NBSP, bidi marks in the ZW cluster range
  s = s.replace(/[\u200B-\u200F\uFEFF\u2060\u00A0]/g, "");

  // Explicit embedding / isolate directional controls (PDF / web copy-paste)
  s = s.replace(/[\u202A-\u202E\u2066-\u2069]/g, "");

  // Line / paragraph separator (Unicode line terminators)
  s = s.replace(/[\u2028\u2029]/g, "");

  s = s.replace(/^["'`]+|["'`]+$/g, "");
  return s.trim();
}
