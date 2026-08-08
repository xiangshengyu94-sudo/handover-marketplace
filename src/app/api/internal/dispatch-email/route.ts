import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { dispatchContactBatch, dispatchNotificationBatch } from "@/lib/email/dispatcher";
import { readServerEnv } from "@/lib/env";

export async function POST(request: Request) {
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  let expected: string;
  try { expected = readServerEnv().cronDispatchSecret; } catch { return NextResponse.json({ error: "Unavailable." }, { status: 503 }); }
  if (!safeEqual(provided, expected)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const [contacts, notifications] = await Promise.all([dispatchContactBatch(10), dispatchNotificationBatch(10)]);
    return NextResponse.json({ processed: contacts.length + notifications.length, contacts, notifications });
  } catch {
    return NextResponse.json({ error: "Dispatch failed." }, { status: 503 });
  }
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
