import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  redirect(user ? "/workspace" : "/login");
}
