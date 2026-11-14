import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  requireActiveMember: vi.fn(),
  consumeRateLimit: vi.fn(),
  hashAbuseKey: vi.fn(() => "member-hash"),
  insertCommunityPost: vi.fn(),
  insertCommunityAnswer: vi.fn(),
  createPublicClient: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

vi.mock("@/lib/auth/require-active-member", () => ({ requireActiveMember: dependencies.requireActiveMember }));
vi.mock("@/lib/auth/admin", () => ({ consumeRateLimit: dependencies.consumeRateLimit, hashAbuseKey: dependencies.hashAbuseKey }));
vi.mock("@/lib/community/admin", () => ({
  insertCommunityPost: dependencies.insertCommunityPost,
  insertCommunityAnswer: dependencies.insertCommunityAnswer,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: dependencies.createPublicClient }));
vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: dependencies.redirect }));

import { createCommunityAnswer, createCommunityPost } from "@/lib/community/actions";

const cityId = "10000000-0000-4000-8000-000000000001";
const questionId = "20000000-0000-4000-8000-000000000002";

function postData(type: "question" | "experience") {
  const form = new FormData();
  form.set("type", type);
  form.set("title", type === "question" ? "Where can I repair my bike?" : "My bike repair experience");
  form.set("body", "A useful local workshop helped me repair my bike last week.");
  form.set("cityId", cityId);
  if (type === "experience") form.set("relatedQuestionId", questionId);
  return form;
}

function answerData() {
  const form = new FormData();
  form.set("questionId", questionId);
  form.set("body", "A useful local workshop helped me repair my bike last week.");
  return form;
}

describe("community publishing actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireActiveMember.mockResolvedValue({ id: "member-1" });
    dependencies.consumeRateLimit.mockResolvedValue({ allowed: true });
    dependencies.insertCommunityPost.mockResolvedValue(questionId);
    dependencies.insertCommunityAnswer.mockResolvedValue(true);
  });

  it.each(["question", "experience"] as const)("publishes a %s through the privileged server boundary", async (type) => {
    await expect(createCommunityPost({ error: "" }, postData(type))).rejects.toThrow("NEXT_REDIRECT");
    expect(dependencies.createPublicClient).not.toHaveBeenCalled();
    expect(dependencies.insertCommunityPost).toHaveBeenCalledWith(expect.objectContaining({
      authorId: "member-1", cityId, type,
      relatedQuestionId: type === "experience" ? questionId : null,
    }));
    expect(dependencies.revalidatePath).toHaveBeenCalledWith("/community");
  });

  it("publishes an answer only through the privileged server boundary", async () => {
    await expect(createCommunityAnswer({ error: "" }, answerData())).rejects.toThrow("NEXT_REDIRECT");
    expect(dependencies.createPublicClient).not.toHaveBeenCalled();
    expect(dependencies.insertCommunityAnswer).toHaveBeenCalledWith(expect.objectContaining({ questionId, authorId: "member-1" }));
  });

  it("does not write after the server-side rate limit denies a post", async () => {
    dependencies.consumeRateLimit.mockResolvedValue({ allowed: false });
    await expect(createCommunityPost({ error: "" }, postData("question"))).resolves.toEqual({ error: "limit" });
    expect(dependencies.insertCommunityPost).not.toHaveBeenCalled();
  });

  it.each([
    ["post rate limit", "consumeRateLimit", "post"],
    ["post insert", "insertCommunityPost", "post"],
    ["answer rate limit", "consumeRateLimit", "answer"],
    ["answer insert", "insertCommunityAnswer", "answer"],
  ] as const)("returns unavailable when %s fails", async (_label, failing, kind) => {
    dependencies[failing].mockRejectedValue(new Error("temporarily unavailable"));
    const result = kind === "post"
      ? createCommunityPost({ error: "" }, postData("question"))
      : createCommunityAnswer({ error: "" }, answerData());
    await expect(result).resolves.toEqual({ error: "unavailable" });
    expect(dependencies.redirect).not.toHaveBeenCalled();
  });
});
