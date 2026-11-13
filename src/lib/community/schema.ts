import { z } from "zod";

import { validatePublicListingText } from "@/lib/listings/public-text-policy";

const optionalId = z.union([z.literal(""), z.uuid()]).transform((value) => value || null);

export const postInputSchema = z.object({
  type: z.enum(["question", "experience"]),
  title: z.string().trim().min(8).max(120),
  body: z.string().trim().min(20).max(4000),
  cityId: z.uuid(),
  organizationId: optionalId,
  relatedQuestionId: optionalId,
}).strict().superRefine((post, context) => {
  if (post.type === "question" && post.relatedQuestionId) {
    context.addIssue({ code: "custom", path: ["relatedQuestionId"], message: "Questions cannot link to another question." });
  }
  for (const issue of validatePublicListingText({ title: post.title, description: post.body, approximateArea: "" })) {
    context.addIssue({ code: "custom", path: [issue.field === "description" ? "body" : "title"], message: issue.message });
  }
});

export const answerInputSchema = z.object({
  questionId: z.uuid(),
  body: z.string().trim().min(20).max(4000),
}).strict().superRefine((answer, context) => {
  for (const issue of validatePublicListingText({ title: "", description: answer.body, approximateArea: "" })) {
    context.addIssue({ code: "custom", path: ["body"], message: issue.message });
  }
});
