import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  from: vi.fn(),
  createPrivilegedClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createPrivilegedClient: database.createPrivilegedClient }));

import { insertCommunityAnswer, insertCommunityPost } from "@/lib/community/admin";

describe("community privileged adapter", () => {
  const insert = vi.fn();
  const select = vi.fn();
  const single = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    database.createPrivilegedClient.mockReturnValue({ from: database.from });
    database.from.mockReturnValue({ insert });
    insert.mockReturnValue({ select });
    select.mockReturnValue({ single });
    single.mockResolvedValue({ data: { id: "post-1" }, error: null });
  });

  it("inserts posts using only the named privileged client", async () => {
    await expect(insertCommunityPost({
      authorId: "member-1", cityId: "city-1", organizationId: null,
      type: "question", title: "Where can I repair my bike?", body: "I need a local repair shop.", relatedQuestionId: null,
    })).resolves.toBe("post-1");
    expect(database.createPrivilegedClient).toHaveBeenCalledWith("src/lib/community/admin.ts");
    expect(database.from).toHaveBeenCalledWith("community_posts");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ author_id: "member-1", city_id: "city-1" }));
  });

  it("inserts answers using only the named privileged client", async () => {
    insert.mockResolvedValue({ error: null });
    await expect(insertCommunityAnswer({ questionId: "question-1", authorId: "member-1", body: "I found a nearby repair shop." })).resolves.toBe(true);
    expect(database.createPrivilegedClient).toHaveBeenCalledWith("src/lib/community/admin.ts");
    expect(database.from).toHaveBeenCalledWith("community_answers");
    expect(insert).toHaveBeenCalledWith({ question_id: "question-1", author_id: "member-1", body: "I found a nearby repair shop." });
  });
});
