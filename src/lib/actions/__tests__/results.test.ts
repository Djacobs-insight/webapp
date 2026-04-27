import { describe, it, expect, vi, beforeEach } from "vitest";

let mockPrisma: Record<string, Record<string, ReturnType<typeof vi.fn>>>;
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

vi.mock("../../age-grading", () => ({
  calculateAgeOnDate: vi.fn().mockReturnValue(35),
  calculateAgeGradedPercentage: vi.fn().mockReturnValue({ percentage: 65.5 }),
}));

vi.mock("../badges", () => ({
  detectBadges: vi.fn().mockResolvedValue([]),
}));

vi.mock("../challenges", () => ({
  resolveExpiredChallenges: vi.fn().mockResolvedValue(undefined),
}));

import { submitResult, getRecentResults, getDashboardSummary } from "../results";

beforeEach(() => {
  mockPrisma = {
    familyMember: { findFirst: vi.fn(), findMany: vi.fn() },
    parkrunLocation: { upsert: vi.fn() },
    parkrunResult: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    photo: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    milestone: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  };
  mockAuth = vi.fn();
  vi.clearAllMocks();
});

const USER_ID = "user-1";
const FAMILY_ID = "family-1";
const RESULT_ID = "result-1";

function mockAuthenticated(userId = USER_ID) {
  mockAuth.mockResolvedValue({ user: { id: userId } });
}

describe("submitResult", () => {
  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await submitResult({ date: "2025-01-01", location: "Bushy Park", finishTime: "25:00" });
    expect(result).toEqual({ success: false, error: "Not authenticated." });
  });

  it("returns error for invalid time format", async () => {
    mockAuthenticated();
    const result = await submitResult({ date: "2025-01-01", location: "Bushy Park", finishTime: "bad" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/mm:ss/);
  });

  it("returns error for empty location", async () => {
    mockAuthenticated();
    const result = await submitResult({ date: "2025-01-01", location: "", finishTime: "25:00" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/Location/);
  });

  it("returns error for future date", async () => {
    mockAuthenticated();
    const result = await submitResult({ date: "2099-01-01", location: "Bushy Park", finishTime: "25:00" });
    expect(result).toEqual({ success: false, error: "Date cannot be in the future." });
  });

  it("returns error when user has no family", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findFirst.mockResolvedValue(null);
    const result = await submitResult({ date: "2025-01-01", location: "Bushy Park", finishTime: "25:00" });
    expect(result).toEqual({ success: false, error: "You must belong to a family to record results." });
  });

  it("creates result with age-grading when user has birthday and gender", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findFirst.mockResolvedValue({ familyId: FAMILY_ID });
    mockPrisma.parkrunLocation.upsert.mockResolvedValue({ id: "loc-1" });
    mockPrisma.user.findUnique.mockResolvedValue({ birthday: new Date("1990-01-01"), gender: "M" });
    mockPrisma.parkrunResult.upsert.mockResolvedValue({ id: RESULT_ID });
    mockPrisma.parkrunResult.count.mockResolvedValue(1);
    mockPrisma.parkrunResult.findFirst.mockResolvedValue({ finishTimeSecs: 1500 });

    const result = await submitResult({ date: "2025-01-04", location: "Bushy Park", finishTime: "25:00" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ageGradedPct).toBe(65.5);
      expect(result.resultId).toBe(RESULT_ID);
    }
  });

  it("upserts parkrun location by name", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findFirst.mockResolvedValue({ familyId: FAMILY_ID });
    mockPrisma.parkrunLocation.upsert.mockResolvedValue({ id: "loc-1" });
    mockPrisma.user.findUnique.mockResolvedValue({ birthday: null, gender: null });
    mockPrisma.parkrunResult.upsert.mockResolvedValue({ id: RESULT_ID });
    mockPrisma.parkrunResult.count.mockResolvedValue(1);
    mockPrisma.parkrunResult.findFirst.mockResolvedValue({ finishTimeSecs: 1500 });

    await submitResult({ date: "2025-01-04", location: " Bushy Park ", finishTime: "25:00" });
    expect(mockPrisma.parkrunLocation.upsert).toHaveBeenCalledWith({
      where: { name: "Bushy Park" },
      create: { name: "Bushy Park" },
      update: {},
    });
  });

  it("attaches photo when provided", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findFirst.mockResolvedValue({ familyId: FAMILY_ID });
    mockPrisma.parkrunLocation.upsert.mockResolvedValue({ id: "loc-1" });
    mockPrisma.user.findUnique.mockResolvedValue({ birthday: null, gender: null });
    mockPrisma.parkrunResult.upsert.mockResolvedValue({ id: RESULT_ID });
    mockPrisma.parkrunResult.count.mockResolvedValue(1);
    mockPrisma.parkrunResult.findFirst.mockResolvedValue({ finishTimeSecs: 1500 });
    mockPrisma.photo.create.mockResolvedValue({});

    await submitResult({
      date: "2025-01-04",
      location: "Bushy Park",
      finishTime: "25:00",
      photo: { displayUrl: "/img/d.jpg", thumbnailUrl: "/img/t.jpg", originalName: "run.jpg" },
    });

    expect(mockPrisma.photo.create).toHaveBeenCalledWith({
      data: {
        resultId: RESULT_ID,
        userId: USER_ID,
        displayUrl: "/img/d.jpg",
        thumbnailUrl: "/img/t.jpg",
        originalName: "run.jpg",
      },
    });
  });

  it("returns error for seconds >= 60 in time", async () => {
    mockAuthenticated();
    const result = await submitResult({ date: "2025-01-01", location: "Bushy Park", finishTime: "25:60" });
    expect(result.success).toBe(false);
  });
});

describe("getRecentResults", () => {
  it("returns empty array when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const results = await getRecentResults();
    expect(results).toEqual([]);
  });

  it("returns formatted results", async () => {
    mockAuthenticated();
    mockPrisma.parkrunResult.findMany.mockResolvedValue([
      {
        id: "r1",
        date: new Date("2025-03-15T00:00:00Z"),
        location: { name: "Bushy Park" },
        finishTimeSecs: 1500,
        ageGradedPct: 65.5,
      },
    ]);
    const results = await getRecentResults(5);
    expect(results).toEqual([
      {
        id: "r1",
        date: "15/03/2025",
        location: "Bushy Park",
        finishTimeSecs: 1500,
        ageGradedPct: 65.5,
      },
    ]);
  });
});

describe("getDashboardSummary", () => {
  it("returns dashes when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const summary = await getDashboardSummary();
    expect(summary).toEqual({ personalBest: "—", streak: "—" });
  });

  it("returns personal best formatted as mm:ss", async () => {
    mockAuthenticated();
    mockPrisma.parkrunResult.findFirst.mockResolvedValue({ finishTimeSecs: 1505 });
    mockPrisma.parkrunResult.findMany.mockResolvedValue([]);
    const summary = await getDashboardSummary();
    expect(summary.personalBest).toBe("25:05");
  });

  it("returns dash for personal best when no results", async () => {
    mockAuthenticated();
    mockPrisma.parkrunResult.findFirst.mockResolvedValue(null);
    mockPrisma.parkrunResult.findMany.mockResolvedValue([]);
    const summary = await getDashboardSummary();
    expect(summary.personalBest).toBe("—");
    expect(summary.streak).toBe("—");
  });
});
