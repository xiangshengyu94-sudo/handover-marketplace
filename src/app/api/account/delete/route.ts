import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/auth/csrf";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import {
  AccountDeletionError,
  deleteAccount,
  recoverAccountDeletion,
  type AccountDeletionResult,
} from "@/lib/privacy/delete-account";

const requestSchema = z
  .object({
    confirmation: z.literal("DELETE"),
    requestKey: z.uuid(),
  })
  .strict();

export async function POST(request: Request) {
  let input: z.infer<typeof requestSchema>;
  try {
    assertSameOrigin({
      origin: request.headers.get("origin") ?? undefined,
      host: request.headers.get("host") ?? undefined,
      forwardedHost: request.headers.get("x-forwarded-host") ?? undefined,
    });
    input = requestSchema.parse(await request.json());
  } catch {
    return errorResponse(400, "Account deletion request is invalid.");
  }

  try {
    const member = await requireActiveMember();
    return successResponse(await deleteAccount(member.id, input.requestKey));
  } catch (caught) {
    if (caught instanceof AuthorizationError) {
      try {
        const recovered = await recoverAccountDeletion(input.requestKey);
        if (recovered) return successResponse(recovered);
      } catch {
        return errorResponse(
          503,
          "Account deletion is temporarily unavailable.",
        );
      }
      return caught.status === 401
        ? errorResponse(401, "Authentication required.")
        : errorResponse(403, "Account deletion is not permitted.");
    }
    if (caught instanceof AccountDeletionError) {
      return caught.code === "last-admin"
        ? errorResponse(
            409,
            "Another administrator is required before this account can be deleted.",
          )
        : errorResponse(
            503,
            "Account deletion is temporarily unavailable.",
          );
    }
    return errorResponse(503, "Account deletion is temporarily unavailable.");
  }
}

function successResponse(result: AccountDeletionResult) {
  return NextResponse.json(result, {
    status: result.status === "partial" ? 202 : 200,
    headers: { "cache-control": "no-store" },
  });
}

function errorResponse(status: number, error: string) {
  return NextResponse.json(
    { error },
    { status, headers: { "cache-control": "no-store" } },
  );
}
