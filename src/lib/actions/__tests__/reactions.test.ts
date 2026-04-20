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

import { toggleReaction, getReactions } from "../reactions";

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
    .mockResolvedValueOnce({ familyId: FAMILY_ID })
    .mockResolvedValueOnce({ familyId: FAMILY_ID });
  mockPrisma.parkrunResult.findUnique.mockResolvedValue({ userId: OTHER_USER_ID });
}

describe("toggleReaction", () => {
  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await toggleReaction({ resultId: RESULT_ID, emoji: "👏" });
    expect(result).toEqual({ success: false, error: "Not authenticated." });
  });

  it("returns error for invalid emoji", async () => {
    mockAuthenticated();
    const result = await toggleReaction({ resultId: RESULT_ID, emoji: "💀" });
    expect(result).toEqual({ success: false, error: "Invalid emoji" });
  });

  it("creates a new reaction", async () => {
    mockAuthenticated();
    mockFamilyAccess();
    mockPrisma.reaction.findUnique.mockResolvedValue(null);
    mockPrisma.reaction.create.mockResolvedValue({});

    const result = await toggleReaction({ resultId: RESULT_ID, emoji: "🔥" });
    expect(result).toEqual({ success: true, added: true });
    expect(mockPrisma.reaction.create).toHaveBeenCalled();
  });

  it("removes existing reaction (toggle off)", async () => {
    mockAuthenticated();
    mockFamilyAccess();
    mockPrisma.reaction.findUnique.mockResolvedValue({ id: "r1", deletedAt: null });
    mockPrisma.reaction.update.mockResolvedValue({});

    const result = await toggleReaction({ resultId: RESULT_ID, emoji: "🔥" });
    expect(result).toEqual({ success: true, added: false });
    expect(mockPrisma.reaction.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("restores soft-deleted reaction (toggle back on)", async () => {
    mockAuthenticated();
    mockFamilyAccess();
    mockPrisma.reaction.findUnique.mockResolvedValue({ id: "r1", deletedAt: new Date() });
    mockPrisma.reaction.update.mockResolvedValue({});

    const result = await toggleReaction({ resultId: RESULT_ID, emoji: "🔥" });
    expect(result).toEqual({ success: true, added: true });
    expect(mockPrisma.reaction.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { deletedAt: null },
    });
  });
});

describe("getReactions", () => {
  it("returns empty array when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await getReactions(RESULT_ID);
    expect(result).toEqual([]);
  });

  it("groups reactions by emoji with current user's state", async () => {
    mockAuthenticated();
    mockPrisma.reaction.findMany.mockResolvedValue([
      { emoji: "👏", userId: USER_ID },
      { emoji: "👏", userId: OTHER_USER_ID },
      { emoji: "🔥", userId: OTHER_USER_ID },
    ]);

    const result = await getReactions(RESULT_ID);
    expect(result).toEqual([
      { emoji: "👏", count: 2, reacted: true },
      { emoji: "🔥", count: 1, reacted: false },
    ]);
  });
});
