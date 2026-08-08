import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { CaptchaProvider } from "@/lib/abuse/captcha";

const responseSchema = z.object({
  success: z.boolean(),
  action: z.string().optional(),
  hostname: z.string().optional(),
});

export class TurnstileProvider implements CaptchaProvider {
  constructor(
    private readonly secretKey: string,
    private readonly remoteIp?: string,
    private readonly expectedHostname?: string,
  ) {}

  async verify(token: string) {
    if (!token || token.length > 2_048) return { success: false };
    const body = new FormData();
    body.set("secret", this.secretKey);
    body.set("response", token);
    body.set("idempotency_key", randomUUID());
    if (this.remoteIp && this.remoteIp !== "unknown") {
      body.set("remoteip", this.remoteIp);
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body, cache: "no-store" },
    );
    if (!response.ok) throw new Error("Verification service unavailable.");

    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Invalid verification response.");
    const hostnameMatches =
      !this.expectedHostname || parsed.data.hostname === this.expectedHostname;
    return {
      success: parsed.data.success && hostnameMatches,
      action: parsed.data.action,
      // Turnstile tokens are single-use; hashing the token in the replay store
      // adds a local atomic guard without persisting the token itself.
      challengeId: parsed.data.success && hostnameMatches ? token : undefined,
    };
  }
}
