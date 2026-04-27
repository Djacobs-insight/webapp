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

import { requestAccountDeletion, undoDeleteAccount } from "../account-deletion";

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockAuth = vi.fn();
  vi.clearAllMocks();
  // $transaction executes all promises passed to it
  mockPrisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
});

const USER_ID = "user-1";

function mockAuthenticated(userId = USER_ID) {
  mockAuth.mockResolvedValue({ user: { id: userId } });
}

function mockAllUpdateManyResolved() {
  mockPrisma.user.update.mockResolvedValue({});
  mockPrisma.parkrunResult.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.photo.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.comment.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.reaction.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.cheer.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.userBadge.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.milestone.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.familyMember.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.challengeParticipant.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.challenge.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.accountDeletion.create.mockResolvedValue({});
}

describe("requestAccountDeletion", () => {
  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await requestAccountDeletion();
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("soft-deletes all user data in a transaction", async () => {
    mockAuthenticated();
    mockAllUpdateManyResolved();

    const result = await requestAccountDeletion();
    expect(result.success).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns a UUID token on success", async () => {
    mockAuthenticated();
    mockAllUpdateManyResolved();

    const result = await requestAccountDeletion();
    expect(result.success).toBe(true);
    if (!result.success) return;
    // Token should be a valid UUID v4
    expect(result.token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("sets deletedAt on the user record", async () => {
    mockAuthenticated();
    mockAllUpdateManyResolved();

    await requestAccountDeletion();

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: { deletedAt: expect.any(Date) },
      }),
    );
  });

  it("soft-deletes results, photos, comments, reactions, cheers, badges, milestones, family members, challenges", async () => {
    mockAuthenticated();
    mockAllUpdateManyResolved();

    await requestAccountDeletion();

    for (const model of [
      "parkrunResult",
      "photo",
      "comment",
      "reaction",
      "cheer",
      "userBadge",
      "milestone",
      "familyMember",
      "challengeParticipant",
    ] as const) {
      expect(mockPrisma[model].updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: USER_ID, deletedAt: null }),
          data: { deletedAt: expect.any(Date) },
        }),
      );
    }

    // Challenges use createdById
    expect(mockPrisma.challenge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdById: USER_ID, deletedAt: null }),
        data: { deletedAt: expect.any(Date) },
      }),
    );
  });
});

describe("undoDeleteAccount", () => {
  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await undoDeleteAccount("2026-04-20T12:00:00.000Z");
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("clears deletedAt on all user data", async () => {
    mockAuthenticated();
    mockAllUpdateManyResolved();

    const deletedAt = new Date("2026-04-20T12:00:00.000Z");
    mockPrisma.accountDeletion.findUnique.mockResolvedValue({ userId: USER_ID, deletedAt });
    const token = "some-uuid-token";
    const result = await undoDeleteAccount(token);

    expect(result.success).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: { deletedAt: null },
      }),
    );
  });

  it("matches deletedAt timestamp from token when clearing", async () => {
    mockAuthenticated();
    mockAllUpdateManyResolved();

    const deletedAt = new Date("2026-04-20T12:00:00.000Z");
    mockPrisma.accountDeletion.findUnique.mockResolvedValue({ userId: USER_ID, deletedAt });
    await undoDeleteAccount("some-uuid-token");

    expect(mockPrisma.parkrunResult.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_ID, deletedAt }),
        data: { deletedAt: null },
      }),
    );
  });
});
