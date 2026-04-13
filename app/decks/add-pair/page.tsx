import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AddLanguagePairClient from "./AddLanguagePairClient";

export const dynamic = "force-dynamic";

export default async function AddLanguagePairPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <AddLanguagePairClient />;
}
