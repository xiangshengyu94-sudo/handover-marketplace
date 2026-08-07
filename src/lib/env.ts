import { z } from "zod";

const appEnvironmentSchema = z.enum([
  "local",
  "test",
  "preview",
  "staging",
  "production",
]);

type EnvironmentSource = Record<string, string | undefined>;

export class EnvironmentConfigurationError extends Error {
  constructor(variable: string, reason = "is required") {
    super(`Environment variable ${variable} ${reason}.`);
    this.name = "EnvironmentConfigurationError";
  }
}

function required(source: EnvironmentSource, variable: string) {
  const value = source[variable]?.trim();
  if (!value) {
    throw new EnvironmentConfigurationError(variable);
  }
  return value;
}

function requiredUrl(source: EnvironmentSource, variable: string) {
  const value = required(source, variable);
  const parsed = z.url().safeParse(value);
  if (!parsed.success) {
    throw new EnvironmentConfigurationError(variable, "must be a valid URL");
  }
  return new URL(parsed.data);
}

export function readPublicEnv(source: EnvironmentSource = process.env) {
  const appEnvironment = appEnvironmentSchema.safeParse(
    required(source, "NEXT_PUBLIC_APP_ENV"),
  );
  if (!appEnvironment.success) {
    throw new EnvironmentConfigurationError(
      "NEXT_PUBLIC_APP_ENV",
      "must name a supported environment",
    );
  }

  return {
    appEnvironment: appEnvironment.data,
    appUrl: requiredUrl(source, "NEXT_PUBLIC_APP_URL"),
    supabaseUrl: requiredUrl(source, "NEXT_PUBLIC_SUPABASE_URL"),
    supabasePublishableKey: required(
      source,
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ),
  } as const;
}

export function readServerEnv(source: EnvironmentSource = process.env) {
  return {
    ...readPublicEnv(source),
    supabaseSecretKey: required(source, "SUPABASE_SECRET_KEY"),
    resendApiKey: required(source, "RESEND_API_KEY"),
    resendWebhookSecret: required(source, "RESEND_WEBHOOK_SECRET"),
  } as const;
}

function looksProduction(value: string) {
  return /(^|[.-])(prod|production)([.-]|$)/i.test(value);
}

export function assertEnvironmentIsolation(
  environment: ReturnType<typeof readServerEnv>,
) {
  if (
    environment.appEnvironment !== "production" &&
    looksProduction(environment.supabaseUrl.hostname)
  ) {
    throw new EnvironmentConfigurationError(
      "NEXT_PUBLIC_SUPABASE_URL",
      `${environment.appEnvironment} deployment cannot use a production Supabase project`,
    );
  }

  if (
    environment.appEnvironment !== "production" &&
    looksProduction(environment.appUrl.hostname)
  ) {
    throw new EnvironmentConfigurationError(
      "NEXT_PUBLIC_APP_URL",
      `${environment.appEnvironment} deployment cannot use a production origin`,
    );
  }
}
