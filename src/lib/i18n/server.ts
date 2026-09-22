import "server-only";

import { cookies } from "next/headers";

import { LOCALE_COOKIE, normalizeLocale } from "./config";

export async function getLocale() {
  return normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}
