import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";

import { apiError } from "@/lib/api/responses";
import { createClient } from "@/lib/supabase/server";

type Authenticated = {
  ok: true;
  db: SupabaseClient;
  user: User;
};

type AuthenticationFailure = {
  ok: false;
  response: NextResponse;
};

export async function requireUser(): Promise<
  Authenticated | AuthenticationFailure
> {
  try {
    const db = await createClient();
    const {
      data: { user },
      error,
    } = await db.auth.getUser();

    if (error) {
      return {
        ok: false,
        response: apiError("Authentication service unavailable", 503),
      };
    }

    if (!user) {
      return {
        ok: false,
        response: apiError("Unauthorized", 401),
      };
    }

    return { ok: true, db, user };
  } catch {
    return {
      ok: false,
      response: apiError("Authentication service unavailable", 503),
    };
  }
}
