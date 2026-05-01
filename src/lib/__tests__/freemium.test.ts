import { describe, it, expect, vi, beforeEach } from "vitest";

let mockPrisma: { familyMember: { count: ReturnType<typeof vi.fn> } };

vi.mock("../prisma", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

import { getFamilyMemberCount, isFamilyAtLimit, FREE_MEMBER_LIMIT } from "../freemium";

beforeEach(() => {
  mockPrisma = {
    familyMember: { count: vi.fn() },
  };
  vi.clearAllMocks();
});

const FAMILY_ID = "family-1";

describe("FREE_MEMBER_LIMIT", () => {
  it("is 30", () => {
    expect(FREE_MEMBER_LIMIT).toBe(30);
  });
});

describe("getFamilyMemberCount", () => {
  it("returns count of active family members", async () => {
    mockPrisma.familyMember.count.mockResolvedValue(2);
    const count = await getFamilyMemberCount(FAMILY_ID);
    expect(count).toBe(2);
    expect(mockPrisma.familyMember.count).toHaveBeenCalledWith({
      where: { familyId: FAMILY_ID, deletedAt: null },
    });
  });

  it("returns 0 when no members", async () => {
    mockPrisma.familyMember.count.mockResolvedValue(0);
    const count = await getFamilyMemberCount(FAMILY_ID);
    expect(count).toBe(0);
  });
});

describe("isFamilyAtLimit", () => {
  it("returns false when under limit", async () => {
    mockPrisma.familyMember.count.mockResolvedValue(FREE_MEMBER_LIMIT - 1);
    expect(await isFamilyAtLimit(FAMILY_ID)).toBe(false);
  });

  it("returns true when at limit", async () => {
    mockPrisma.familyMember.count.mockResolvedValue(FREE_MEMBER_LIMIT);
    expect(await isFamilyAtLimit(FAMILY_ID)).toBe(true);
  });

  it("returns true when over limit", async () => {
    mockPrisma.familyMember.count.mockResolvedValue(FREE_MEMBER_LIMIT + 2);
    expect(await isFamilyAtLimit(FAMILY_ID)).toBe(true);
  });
});
