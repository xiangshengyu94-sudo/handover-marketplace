import { NextResponse } from "next/server";

import { getListingImageSignedUrl } from "@/lib/images/process";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;
  let viewerId: string | undefined;
  const client = await createClient();
  const { data } = await client.auth.getClaims();
  if (typeof data?.claims.sub === "string") viewerId = data.claims.sub;
  try {
    const signedUrl = await getListingImageSignedUrl(imageId, viewerId);
    if (!signedUrl) return notFound();
    const response = NextResponse.redirect(signedUrl, 307);
    response.headers.set("cache-control", "private, no-store");
    response.headers.set("referrer-policy", "no-referrer");
    return response;
  } catch {
    return notFound();
  }
}

function notFound() {
  return NextResponse.json({ error: "Not found." }, { status: 404, headers: { "cache-control": "no-store" } });
}
