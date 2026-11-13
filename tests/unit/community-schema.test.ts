import { describe, expect, it } from "vitest";

import { answerInputSchema, postInputSchema } from "@/lib/community/schema";

const cityId = "11111111-1111-4111-8111-111111111111";
const questionId = "22222222-2222-4222-8222-222222222222";

describe("community publishing input", () => {
  it("accepts a city-scoped question without a related question", () => {
    expect(postInputSchema.safeParse({ type: "question", title: "Where can I repair a bike?", body: "I have just arrived and need a trustworthy repair shop nearby.", cityId, organizationId: "", relatedQuestionId: "" }).success).toBe(true);
  });

  it("accepts an independent experience linked to a question", () => {
    expect(postInputSchema.safeParse({ type: "experience", title: "How I repaired my bike in Valencia", body: "I compared two repair options and found a useful local workshop.", cityId, organizationId: "", relatedQuestionId: questionId }).success).toBe(true);
  });

  it("rejects a question that pretends to link to another question", () => {
    expect(postInputSchema.safeParse({ type: "question", title: "Where can I repair a bike?", body: "I have just arrived and need a trustworthy repair shop nearby.", cityId, organizationId: "", relatedQuestionId: questionId }).success).toBe(false);
  });

  it("rejects private contact details in public answers", () => {
    expect(answerInputSchema.safeParse({ questionId, body: "Email me at example@example.com for the answer." }).success).toBe(false);
  });
});
