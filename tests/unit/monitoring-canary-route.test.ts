import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  captureOperationalCanary:
    vi.fn<(name: "launch-readiness") => Promise<string | null>>(),
  readServerEnv: vi.fn<() => { monitoringCanarySecret: string }>(),
}));

vi.mock("@/lib/env", () => ({ readServerEnv: dependencies.readServerEnv }));
vi.mock("@/lib/monitoring/sentry", () => ({
  captureOperationalCanary: dependencies.captureOperationalCanary,
}));

import { POST } from "@/app/api/internal/monitoring-canary/route";

function request(authorization?: string) {
  return new Request("https://handover.example/api/internal/monitoring-canary", {
    method: "POST",
    headers: authorization ? { authorization } : undefined,
  });
}

describe("monitoring canary route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.readServerEnv.mockReturnValue({
      monitoringCanarySecret: "expected-secret",
    });
    dependencies.captureOperationalCanary.mockResolvedValue(
      "0123456789abcdef0123456789abcdef",
    );
  });

  it.each([undefined, "Bearer wrong-secret"])(
    "returns the same 404 for a missing or invalid credential",
    async (authorization) => {
      const response = await POST(request(authorization));
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "Not found." });
      expect(dependencies.captureOperationalCanary).not.toHaveBeenCalled();
    },
  );

  it("returns the captured event ID for an authenticated, flushed canary", async () => {
    const response = await POST(request("Bearer expected-secret"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      captured: true,
      eventId: "0123456789abcdef0123456789abcdef",
    });
  });

  it("returns 503 when the SDK cannot queue the authenticated canary", async () => {
    dependencies.captureOperationalCanary.mockResolvedValue(null);
    const response = await POST(request("Bearer expected-secret"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Unavailable." });
  });
});
