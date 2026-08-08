import { z } from "zod";

export const lifecycleActionSchema = z.enum(["reserve", "reopen", "complete", "withdraw", "renew", "delete"]);
export type LifecycleAction = z.infer<typeof lifecycleActionSchema>;

const allowed: Record<string, readonly LifecycleAction[]> = {
  draft: ["withdraw", "delete"],
  active: ["reserve", "complete", "withdraw", "renew", "delete"],
  reserved: ["reopen", "complete", "withdraw", "renew", "delete"],
  completed: ["delete"],
  expired: ["renew", "delete"],
  withdrawn: ["renew", "delete"],
};

export function allowedLifecycleActions(status: string) {
  return allowed[status] ?? [];
}

export function parseRenewalDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}
