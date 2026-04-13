"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

type Props = {
  userId: string;
  initialDisplayName: string;
};

export default function DisplayNameForm({ userId, initialDisplayName }: Props) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    setLoading(true);

    const normalized = displayName.trim();
    const { error: upsertErr } = await supabase.from("profiles").upsert(
      {
        id: userId,
        display_name: normalized.length > 0 ? normalized : null,
      },
      { onConflict: "id" }
    );

    setLoading(false);
    if (upsertErr) {
      setError(upsertErr.message || "Could not save your display name.");
      return;
    }

    setDisplayName(normalized);
    setMsg("Display name saved.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-1">
        <label className="text-sm text-neutral-700" htmlFor="display-name">
          Display name
        </label>
        <Input
          id="display-name"
          name="displayName"
          placeholder="How your name appears in the header"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={60}
          autoComplete="nickname"
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save display name"}
      </Button>

      {msg ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {msg}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </form>
  );
}
