import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const unsafePathCharacters = /[\u0000-\u001f\u007f\\]/;

export function safeNextPath(next: string | null, origin: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/workspace";
  }

  let decoded = next;

  while (true) {
    if (
      unsafePathCharacters.test(decoded) ||
      !decoded.startsWith("/") ||
      decoded.startsWith("//")
    ) {
      return "/workspace";
    }

    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) {
        break;
      }
      decoded = nextDecoded;
    } catch {
      return "/workspace";
    }
  }

  try {
    const resolved = new URL(next, origin);
    return resolved.origin === origin ? next : "/workspace";
  } catch {
    return "/workspace";
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), url.origin);

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=auth_callback", url.origin),
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        new URL("/login?error=auth_callback", url.origin),
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=auth_callback", url.origin),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
