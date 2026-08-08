import "server-only";

export type CaptchaRisk = {
  ipAttempts: number;
  identityAttempts: number;
  recentFailures: number;
};

export function evaluateCaptchaRequirement(risk: CaptchaRisk) {
  return (
    risk.ipAttempts >= 8 ||
    risk.identityAttempts >= 5 ||
    risk.recentFailures >= 3 ||
    risk.identityAttempts + risk.recentFailures >= 6
  );
}

type CaptchaProviderResult = {
  success: boolean;
  action?: string;
  challengeId?: string;
};

export interface CaptchaProvider {
  verify(token: string): Promise<CaptchaProviderResult>;
}

export interface CaptchaReplayStore {
  consume(challengeId: string, expiresAt: Date): Promise<boolean>;
}

export type CaptchaErrorCode =
  | "required"
  | "rejected"
  | "action_mismatch"
  | "replayed"
  | "provider_unavailable";

export class CaptchaError extends Error {
  constructor(
    readonly code: CaptchaErrorCode,
    readonly retryable = false,
  ) {
    super(
      code === "required"
        ? "Please complete the verification challenge."
        : "Verification could not be completed.",
    );
    this.name = "CaptchaError";
  }
}

type VerifyCaptchaInput = {
  token?: string;
  expectedAction: string;
  provider: CaptchaProvider;
  replayStore: CaptchaReplayStore;
  now?: Date;
  timeoutMs?: number;
};

export async function verifyCaptcha({
  token,
  expectedAction,
  provider,
  replayStore,
  now = new Date(),
  timeoutMs = 4_000,
}: VerifyCaptchaInput): Promise<void> {
  if (!token) throw new CaptchaError("required");

  let result: CaptchaProviderResult;
  try {
    result = await withTimeout(provider.verify(token), timeoutMs);
  } catch {
    throw new CaptchaError("provider_unavailable", true);
  }

  if (!result.success || !result.challengeId) {
    throw new CaptchaError("rejected");
  }
  if (result.action !== expectedAction) {
    throw new CaptchaError("action_mismatch");
  }

  const expiresAt = new Date(now.getTime() + 10 * 60 * 1_000);
  if (!(await replayStore.consume(result.challengeId, expiresAt))) {
    throw new CaptchaError("replayed");
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
