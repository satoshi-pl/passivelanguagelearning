import { redirect } from "next/navigation";
import { Container } from "../components/Container";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import DisplayNameForm from "./DisplayNameForm";

type ProfileRow = {
  display_name: string | null;
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id" });
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const initialDisplayName = ((profile as ProfileRow | null)?.display_name || "").trim();

  return (
    <Container>
      <div className="mx-auto mt-10 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Set the display name shown in your header. Email login stays unchanged.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DisplayNameForm userId={user.id} initialDisplayName={initialDisplayName} />
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
