import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  applyResendEvent: vi.fn<(input: object) => Promise<boolean>>(),
  captureOperationalFailure: vi.fn<(signal: string) => void>(),
  verifyResendWebhook: vi.fn<(input: object) => {
    data: { email_id: string };
    type: string;
    created_at: string;
  }>(),
}));

vi.mock("@/lib/email/dispatcher", () => ({
  applyResendEvent: dependencies.applyResendEvent,
}));
vi.mock("@/lib/email/resend", () => ({
  verifyResendWebhook: dependencies.verifyResendWebhook,
}));
vi.mock("@/lib/monitoring/sentry", () => ({
  captureOperationalFailure: dependencies.captureOperationalFailure,
}));

import { POST } from "@/app/api/webhooks/resend/route";

function request() {
  return new Request("https://handover.example/api/webhooks/resend", {
    method: "POST",
    body: '{"type":"email.delivered"}',
    headers: {
      "svix-id": "event-1",
      "svix-timestamp": "1786176000",
      "svix-signature": "v1,signature",
    },
  });
}

describe("Resend webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.verifyResendWebhook.mockReturnValue({
      data: { email_id: "email-1" },
      type: "email.delivered",
      created_at: "2026-08-08T10:00:00.000Z",
    });
    dependencies.applyResendEvent.mockResolvedValue(true);
  });

  it("classifies signature verification failures as invalid requests", async () => {
    dependencies.verifyResendWebhook.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const response = await POST(request());
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid webhook." });
    expect(dependencies.captureOperationalFailure).toHaveBeenCalledWith(
      "webhook-signature-or-replay-failures",
    );
    expect(dependencies.applyResendEvent).not.toHaveBeenCalled();
  });

  it("returns 503 and a processing signal when persistence fails", async () => {
    dependencies.applyResendEvent.mockRejectedValue(
      new Error("database unavailable"),
    );

    const response = await POST(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Webhook processing unavailable.",
    });
    expect(dependencies.captureOperationalFailure).toHaveBeenCalledWith(
      "webhook-processing-failures",
    );
  });
});
