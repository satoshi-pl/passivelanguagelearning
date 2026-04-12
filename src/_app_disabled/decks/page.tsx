import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DecksPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: decks, error } = await supabase
    .from("decks")
    .select("id, name, target_lang, native_lang, created_at")
    .order("created_at", { ascending: false });

  return (
    <div style={{ maxWidth: 900, margin: "40px auto" }}>
      <div>
        <h1 style={{ marginBottom: 6 }}>Your decks</h1>
        <div style={{ opacity: 0.7 }}>Logged in as {user.email}</div>
      </div>

      <div style={{ height: 18 }} />

      {error ? (
        <pre>{JSON.stringify(error, null, 2)}</pre>
      ) : !decks || decks.length === 0 ? (
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 14,
            padding: 18,
            background: "white",
          }}
        >
          <b>No decks available yet.</b>
          <div style={{ opacity: 0.7, marginTop: 6 }}>
            Decks are provided by the creator. Refresh once if you just signed up.
          </div>
        </div>
      ) : (
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 14,
            padding: 18,
            background: "white",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Decks</h2>
              <div style={{ opacity: 0.7, marginTop: 4 }}>
                Click a deck to open it or start practice.
              </div>
            </div>
            <div style={{ opacity: 0.6, alignSelf: "center" }}>
              {decks.length} total
            </div>
          </div>

          <div style={{ height: 8 }} />

          <div style={{ display: "grid", gap: 10 }}>
            {decks.map((d) => (
              <Link
                key={d.id}
                href={`/decks/${String(d.id)}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: "14px 16px",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{d.name}</div>
                  <div style={{ opacity: 0.7, marginTop: 4 }}>
                    {d.target_lang} → {d.native_lang}
                  </div>
                </div>
                <div style={{ opacity: 0.7 }}>Open →</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
