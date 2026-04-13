import { redirect } from "next/navigation";
import SetupDecksClient from "./SetupDecksClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SetupPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existingDecks, error } = await supabase.from("decks").select("id").limit(1);
  if (!error && existingDecks && existingDecks.length > 0) {
    redirect("/decks");
  }

  return <SetupDecksClient />;
}
