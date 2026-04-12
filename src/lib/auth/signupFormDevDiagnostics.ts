/**
 * Signup diagnostics when NEXT_PUBLIC_SIGNUP_DEBUG_V2=1 (local dev + Vercel Preview builds).
 * Never log raw passwords — password length only.
 */
function isSignupDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SIGNUP_DEBUG_V2 === "1";
}

/** Form DOM + path-1 console logs immediately before supabase.auth.signUp (real FormData path). */
export function logSignupFormDevDiagnostics(
  form: HTMLFormElement,
  emailRaw: string,
  cleanedEmail: string,
  passwordLen: number
): void {
  if (!isSignupDebugEnabled()) return;

  console.log("[signup][path1] emailRaw", JSON.stringify(emailRaw));
  console.log("[signup][path1] cleanedEmail", JSON.stringify(cleanedEmail));
  console.log("[signup][path1] cleanedEmail.length", cleanedEmail.length);
  console.log(
    "[signup][path1] cleanedEmail charCodes",
    [...cleanedEmail].map((ch) => ch.codePointAt(0))
  );

  const elements = Array.from(form.elements);
  const emailCount = elements.filter(
    (el) => el instanceof HTMLInputElement && el.name === "email"
  ).length;
  const passwordCount = elements.filter(
    (el) => el instanceof HTMLInputElement && el.name === "password"
  ).length;

  console.log("[signup] named controls count", { emailCount, passwordCount });
  console.log(
    "[signup] form elements",
    elements.map((el) => ({
      tag: el.tagName,
      type: el instanceof HTMLInputElement ? el.type : undefined,
      name: el instanceof HTMLElement && "name" in el ? (el as HTMLInputElement).name : undefined,
      id: el instanceof HTMLElement ? el.id : undefined,
    }))
  );
  console.log("[signup] emailRaw charCodes", [...emailRaw].map((ch) => ch.codePointAt(0)));
  console.log("[signup] password length", passwordLen);
}

/** Hardcoded signUp — full structured payload (same as on-screen debug). */
export function logHardcodedSignupTestFullPayload(payload: Record<string, unknown>): void {
  if (!isSignupDebugEnabled()) return;
  console.log("[signup][path2 hardcoded] full signUp debug payload", payload);
}
