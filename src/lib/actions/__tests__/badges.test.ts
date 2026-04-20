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

import { detectBadges, getUserBadges, getBadgeFamilyHolders } from "../badges";

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockAuth = vi.fn();
  vi.clearAllMocks();
});

const USER_ID = "user-1";
const RESULT_ID = "result-1";
const FAMILY_ID = "family-1";

function mockBadgeStats(overrides: Partial<{
  runCount: number;
  fastestTime: number | null;
  bestAgeGrade: number | null;
  photoCount: number;
  commentCount: number;
  results: { date: Date }[];
}> = {}) {
  const { runCount = 1, fastestTime = 1800, bestAgeGrade = null, photoCount = 0, commentCount = 0, results = [] } = overrides;
  mockPrisma.parkrunResult.count.mockResolvedValue(runCount);
  mockPrisma.parkrunResult.findFirst
    .mockResolvedValueOnce(fastestTime !== null ? { finishTimeSecs: fastestTime } : null)
    .mockResolvedValueOnce(bestAgeGrade !== null ? { ageGradedPct: bestAgeGrade } : null);
  mockPrisma.photo.count.mockResolvedValue(photoCount);
  mockPrisma.comment.count.mockResolvedValue(commentCount);
  mockPrisma.parkrunResult.findMany.mockResolvedValue(results);
}

describe("detectBadges", () => {
  it("awards first_run badge for a new user's first result", async () => {
    mockBadgeStats({ runCount: 1 });
    // No existing badges
    mockPrisma.userBadge.findUnique.mockResolvedValue(null);
    mockPrisma.userBadge.create.mockResolvedValue({});

    const result = await detectBadges(USER_ID, RESULT_ID, 1800, null);

    const firstRun = result.find((b) => b.key === "first_run");
    expect(firstRun).toBeDefined();
    expect(firstRun!.label).toContain("First Steps");
  });

  it("awards sub_30 badge when finish time is under 30 minutes", async () => {
    mockBadgeStats({ runCount: 5 });
    mockPrisma.userBadge.findUnique.mockResolvedValue(null);
    mockPrisma.userBadge.create.mockResolvedValue({});

    const result = await detectBadges(USER_ID, RESULT_ID, 29 * 60, null);

    const sub30 = result.find((b) => b.key === "sub_30");
    expect(sub30).toBeDefined();
  });

  it("does not award sub_30 when finish time is 30 minutes exactly", async () => {
    mockBadgeStats({ runCount: 5 });
    mockPrisma.userBadge.findUnique.mockResolvedValue(null);
    mockPrisma.userBadge.create.mockResolvedValue({});

    const result = await detectBadges(USER_ID, RESULT_ID, 30 * 60, null);

    const sub30 = result.find((b) => b.key === "sub_30");
    expect(sub30).toBeUndefined();
  });

  it("awards age grade badge when percentage threshold is met", async () => {
    mockBadgeStats({ runCount: 1 });
    mockPrisma.userBadge.findUnique.mockResolvedValue(null);
    mockPrisma.userBadge.create.mockResolvedValue({});

    const result = await detectBadges(USER_ID, RESULT_ID, 1800, 72);

    const ag70 = result.find((b) => b.key === "ag_70");
    expect(ag70).toBeDefined();
  });

  it("does not award badge when age grade is null", async () => {
    mockBadgeStats({ runCount: 1 });
    mockPrisma.userBadge.findUnique.mockResolvedValue(null);
    mockPrisma.userBadge.create.mockResolvedValue({});

    const result = await detectBadges(USER_ID, RESULT_ID, 1800, null);

    const agBadges = result.filter((b) => b.key.startsWith("ag_"));
    expect(agBadges).toHaveLength(0);
  });

  it("does not re-award existing badges", async () => {
    mockBadgeStats({ runCount: 10 });
    // Badge already exists
    mockPrisma.userBadge.findUnique.mockResolvedValue({ id: "existing" });

    const result = await detectBadges(USER_ID, RESULT_ID, 1800, null);

    expect(result).toHaveLength(0);
    expect(mockPrisma.userBadge.create).not.toHaveBeenCalled();
  });

  it("awards multiple badges at once when criteria are met", async () => {
    mockBadgeStats({ runCount: 10 });
    mockPrisma.userBadge.findUnique.mockResolvedValue(null);
    mockPrisma.userBadge.create.mockResolvedValue({});

    const result = await detectBadges(USER_ID, RESULT_ID, 24 * 60, 75);

    // Should get: first_run, runs_10, sub_30, sub_25, ag_60, ag_70
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result.map((b) => b.key)).toContain("sub_25");
    expect(result.map((b) => b.key)).toContain("ag_70");
  });
});

describe("getUserBadges", () => {
  it("returns empty array when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await getUserBadges();
    expect(result).toEqual([]);
  });

  it("returns all badges with earned status", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_ID } });
    mockPrisma.userBadge.findMany.mockResolvedValue([
      { badgeKey: "first_run", awardedAt: new Date("2026-01-15") },
    ]);
    mockBadgeStats({ runCount: 3 });

    const result = await getUserBadges();

    expect(result.length).toBe(15); // all badge definitions
    const firstRun = result.find((b) => b.key === "first_run");
    expect(firstRun?.earned).toBe(true);
    expect(firstRun?.awardedAt).toBeTruthy();

    const runs10 = result.find((b) => b.key === "runs_10");
    expect(runs10?.earned).toBe(false);
    expect(runs10?.progressHint).toContain("7 more runs");
  });
});

describe("getBadgeFamilyHolders", () => {
  it("returns empty when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await getBadgeFamilyHolders("first_run");
    expect(result).toEqual([]);
  });

  it("returns family members who hold the badge", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_ID } });
    mockPrisma.familyMember.findFirst.mockResolvedValue({ familyId: FAMILY_ID });
    mockPrisma.familyMember.findMany.mockResolvedValue([
      { userId: USER_ID },
      { userId: "user-2" },
    ]);
    mockPrisma.userBadge.findMany.mockResolvedValue([
      { userId: USER_ID, badgeKey: "first_run", awardedAt: new Date("2026-01-10"), user: { name: "Alice" } },
    ]);

    const result = await getBadgeFamilyHolders("first_run");

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alice");
    expect(result[0].userId).toBe(USER_ID);
  });

  it("returns empty when user has no family", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_ID } });
    mockPrisma.familyMember.findFirst.mockResolvedValue(null);

    const result = await getBadgeFamilyHolders("first_run");
    expect(result).toEqual([]);
  });
});
