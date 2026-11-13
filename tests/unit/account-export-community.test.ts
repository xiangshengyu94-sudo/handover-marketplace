import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createPrivilegedClient: vi.fn(() => database),
}));

import { exportAccountData } from "@/lib/privacy/export";

describe("account export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.from.mockImplementation((table: string) => ({
      select: () => ({ eq: (column: string, userId: string) => Promise.resolve({
        data: column === "author_id" && userId === "member-1"
          ? table === "community_posts"
            ? [{ id: "question-1", type: "question" }, { id: "experience-1", type: "experience" }]
            : [{ id: "answer-1", body: "An answer" }]
          : [{ id: "someone-elses-content" }],
        error: null,
      }) }),
    }));
    database.rpc.mockResolvedValue({ data: { account: { email: "member@example.test" }, listings: [] }, error: null });
  });

  it("includes authored questions, experiences, and answers with the existing account data", async () => {
    await expect(exportAccountData("member-1")).resolves.toMatchObject({
      account: { email: "member@example.test" },
      communityPosts: [{ id: "question-1", type: "question" }, { id: "experience-1", type: "experience" }],
      communityAnswers: [{ id: "answer-1" }],
    });
    expect(database.from).toHaveBeenCalledWith("community_posts");
    expect(database.from).toHaveBeenCalledWith("community_answers");
    expect(database.rpc).toHaveBeenCalledWith("admin_export_user_data", expect.objectContaining({ p_user_id: "member-1" }));
  });

  it("does not issue a completed export receipt when community data cannot be read", async () => {
    database.from.mockImplementation((table: string) => ({
      select: () => ({ eq: () => Promise.resolve({ data: null, error: table === "community_answers" ? { message: "unavailable" } : null }) }),
    }));
    await expect(exportAccountData("member-1")).rejects.toThrow("Account export failed.");
    expect(database.rpc).not.toHaveBeenCalled();
  });
});
