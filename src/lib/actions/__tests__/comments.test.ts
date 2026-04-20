import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers";

let mockPrisma: MockPrisma;
let mockAuth: ReturnType<typeof vi.fn>;

vi.mock("../../prisma", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

vi.mock("../../auth/auth", () => ({
  get auth() {
    return mockAuth;
  },
}));

// Must import AFTER mocks are set up
import { addComment, deleteComment, restoreComment, getComments } from "../comments";

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockAuth = vi.fn();
  vi.clearAllMocks();
});

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const FAMILY_ID = "family-1";
const RESULT_ID = "result-1";

function mockAuthenticated(userId = USER_ID) {
  mockAuth.mockResolvedValue({ user: { id: userId } });
}

function mockFamilyAccess() {
  mockPrisma.familyMember.findFirst
    .mockResolvedValueOnce({ familyId: FAMILY_ID }) // user's membership
    .mockResolvedValueOnce({ familyId: FAMILY_ID }); // result owner's membership
  mockPrisma.parkrunResult.findUnique.mockResolvedValue({ userId: OTHER_USER_ID });
}

describe("addComment", () => {
  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await addComment({ resultId: RESULT_ID, text: "Great run!" });
    expect(result).toEqual({ success: false, error: "Not authenticated." });
  });

  it("returns error when text is empty", async () => {
    mockAuthenticated();
    const result = await addComment({ resultId: RESULT_ID, text: "" });
    expect(result).toEqual({ success: false, error: "Comment cannot be empty" });
  });

  it("returns error when text exceeds 500 chars", async () => {
    mockAuthenticated();
    const result = await addComment({ resultId: RESULT_ID, text: "x".repeat(501) });
    expect(result).toEqual({ success: false, error: "Comment is too long" });
  });

  it("returns error when user has no family", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findFirst.mockResolvedValue(null);
    const result = await addComment({ resultId: RESULT_ID, text: "Nice!" });
    expect(result).toEqual({ success: false, error: "You must belong to a family." });
  });

  it("returns error when result not found", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findFirst.mockResolvedValue({ familyId: FAMILY_ID });
    mockPrisma.parkrunResult.findUnique.mockResolvedValue(null);
    const result = await addComment({ resultId: RESULT_ID, text: "Nice!" });
    expect(result).toEqual({ success: false, error: "Result not found." });
  });

  it("creates comment and returns it on success", async () => {
    mockAuthenticated();
    mockFamilyAccess();
    const now = new Date();
    mockPrisma.comment.create.mockResolvedValue({
      id: "comment-1",
      text: "Great run!",
      userId: USER_ID,
      createdAt: now,
      user: { name: "Test User" },
    });

    const result = await addComment({ resultId: RESULT_ID, text: "  Great run!  " });
    expect(result).toEqual({
      success: true,
      comment: {
        id: "comment-1",
        text: "Great run!",
        authorName: "Test User",
        authorId: USER_ID,
        createdAt: now.toISOString(),
      },
    });
    // Verify text was trimmed
    expect(mockPrisma.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ text: "Great run!" }),
      }),
    );
  });
});

describe("deleteComment", () => {
  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await deleteComment("comment-1");
    expect(result).toEqual({ success: false, error: "Not authenticated." });
  });

  it("returns error when comment not found", async () => {
    mockAuthenticated();
    mockPrisma.comment.findUnique.mockResolvedValue(null);
    const result = await deleteComment("comment-1");
    expect(result).toEqual({ success: false, error: "Comment not found." });
  });

  it("returns error when comment already deleted", async () => {
    mockAuthenticated();
    mockPrisma.comment.findUnique.mockResolvedValue({ userId: USER_ID, deletedAt: new Date() });
    const result = await deleteComment("comment-1");
    expect(result).toEqual({ success: false, error: "Comment not found." });
  });

  it("returns error when deleting another user's comment", async () => {
    mockAuthenticated();
    mockPrisma.comment.findUnique.mockResolvedValue({ userId: OTHER_USER_ID, deletedAt: null });
    const result = await deleteComment("comment-1");
    expect(result).toEqual({ success: false, error: "You can only delete your own comments." });
  });

  it("soft-deletes own comment", async () => {
    mockAuthenticated();
    mockPrisma.comment.findUnique.mockResolvedValue({ userId: USER_ID, deletedAt: null });
    mockPrisma.comment.update.mockResolvedValue({});
    const result = await deleteComment("comment-1");
    expect(result).toEqual({ success: true });
    expect(mockPrisma.comment.update).toHaveBeenCalledWith({
      where: { id: "comment-1" },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe("restoreComment", () => {
  it("returns error when restoring another user's comment", async () => {
    mockAuthenticated();
    mockPrisma.comment.findUnique.mockResolvedValue({ userId: OTHER_USER_ID, deletedAt: new Date() });
    const result = await restoreComment("comment-1");
    expect(result).toEqual({ success: false, error: "You can only restore your own comments." });
  });

  it("restores own comment", async () => {
    mockAuthenticated();
    mockPrisma.comment.findUnique.mockResolvedValue({ userId: USER_ID, deletedAt: new Date() });
    mockPrisma.comment.update.mockResolvedValue({});
    const result = await restoreComment("comment-1");
    expect(result).toEqual({ success: true });
    expect(mockPrisma.comment.update).toHaveBeenCalledWith({
      where: { id: "comment-1" },
      data: { deletedAt: null },
    });
  });
});

describe("getComments", () => {
  it("returns empty array when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await getComments(RESULT_ID);
    expect(result).toEqual([]);
  });

  it("returns comments for family-accessible result", async () => {
    mockAuthenticated();
    mockFamilyAccess();
    const now = new Date();
    mockPrisma.comment.findMany.mockResolvedValue([
      { id: "c1", text: "Nice!", userId: USER_ID, createdAt: now, user: { name: "Alice" } },
      { id: "c2", text: "Fast!", userId: OTHER_USER_ID, createdAt: now, user: { name: "Bob" } },
    ]);

    const result = await getComments(RESULT_ID);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "c1",
      text: "Nice!",
      authorName: "Alice",
      authorId: USER_ID,
      createdAt: now.toISOString(),
    });
  });
});
