import { NextResponse } from "next/server";

import { apiError } from "@/lib/api/responses";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const db = await createClient();
    const { error } = await db.auth.signOut();
    if (error) {
      return apiError("Sign out is temporarily unavailable", 503);
    }
    return NextResponse.redirect(new URL("/login", request.url), 303);
  } catch {
    return apiError("Sign out is temporarily unavailable", 503);
  }
}
