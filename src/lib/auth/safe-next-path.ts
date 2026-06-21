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
