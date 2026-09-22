import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/auth/csrf";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import { BRAND_SLUG } from "@/lib/brand";
import { exportAccountData } from "@/lib/privacy/export";

export async function POST(request: Request) {
  try {
    assertSameOrigin({
      origin: request.headers.get("origin") ?? undefined,
      host: request.headers.get("host") ?? undefined,
      forwardedHost: request.headers.get("x-forwarded-host") ?? undefined,
    });
    const member = await requireActiveMember();
    const data = await exportAccountData(member.id);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(data), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${BRAND_SLUG}-export-${date}.json"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (caught) {
    const status = caught instanceof AuthorizationError ? caught.status : 400;
    return NextResponse.json(
      {
        error:
          status === 401
            ? "Authentication required."
            : "Export could not be created.",
      },
      { status },
    );
  }
}
