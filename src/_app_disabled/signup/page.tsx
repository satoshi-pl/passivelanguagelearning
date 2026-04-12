"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return setMsg(error.message);

    router.push("/decks");
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <h1>Sign up</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Create account</button>
      </form>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
      <p style={{ marginTop: 12 }}>
        Have an account? <a href="/login">Login</a>
      </p>
    </div>
  );
}
