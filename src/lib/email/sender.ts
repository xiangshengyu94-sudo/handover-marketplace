import { BRAND_NAME } from "@/lib/brand";

export function brandedEmailSender(configuredSender: string) {
  const trimmed = configuredSender.trim();
  const address = trimmed.match(/<([^<>]+)>$/)?.[1]?.trim() ?? trimmed;

  return `${BRAND_NAME} <${address}>`;
}

