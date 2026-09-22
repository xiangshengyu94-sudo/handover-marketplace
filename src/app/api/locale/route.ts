import { type NextRequest, NextResponse } from "next/server";

import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";

export async function POST(request: NextRequest) {
  const payload: unknown = await request.json().catch(() => null);
  const locale = payload && typeof payload === "object" && "locale" in payload
    ? (payload as { locale?: unknown }).locale
    : undefined;

  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Unsupported locale." }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    maxAge: 365 * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
