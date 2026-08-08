import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/auth/csrf";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import { processListingImage } from "@/lib/images/process";

const bodySchema = z.object({ imageId: z.uuid(), generation: z.uuid() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const listingId = z.uuid().parse(id);
    assertSameOrigin({
      origin: request.headers.get("origin") ?? undefined,
      host: request.headers.get("host") ?? undefined,
      forwardedHost: request.headers.get("x-forwarded-host") ?? undefined,
    });
    const member = await requireActiveMember();
    const body = bodySchema.parse(await request.json());
    const result = await processListingImage({ ...body, listingId, ownerId: member.id });
    if (result.status === "failed") return NextResponse.json({ error: "Image processing failed." }, { status: 422 });
    return NextResponse.json(result, { status: result.status === "stale" ? 409 : 200 });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 400;
    return NextResponse.json({ error: status === 401 ? "Authentication required." : "Request not accepted." }, { status });
  }
}
