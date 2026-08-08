const AUTH_ENTRY_PATHS = new Set(["/login", "/auth/confirm"]);
const CONTROL_OR_BACKSLASH = /[\\\u0000-\u001f\u007f]/;

export function sanitizeReturnTo(
  candidate: unknown,
  fallback = "/account",
): string {
  const safeFallback = isSafeInternalPath(fallback) ? fallback : "/account";
  if (typeof candidate !== "string" || !isSafeInternalPath(candidate)) {
    return safeFallback;
  }
  return candidate;
}

function isSafeInternalPath(candidate: string) {
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    CONTROL_OR_BACKSLASH.test(candidate)
  ) {
    return false;
  }

  try {
    const parsed = new URL(candidate, "https://handover.invalid");
    return (
      parsed.origin === "https://handover.invalid" &&
      !AUTH_ENTRY_PATHS.has(parsed.pathname)
    );
  } catch {
    return false;
  }
}
