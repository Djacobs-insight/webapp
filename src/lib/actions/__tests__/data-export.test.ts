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

import { exportResultsCsv } from "../data-export";

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockAuth = vi.fn();
  vi.clearAllMocks();
});

const USER_ID = "user-1";

function mockAuthenticated(userId = USER_ID) {
  mockAuth.mockResolvedValue({ user: { id: userId } });
}

describe("exportResultsCsv", () => {
  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await exportResultsCsv();
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns error when user has no results", async () => {
    mockAuthenticated();
    mockPrisma.parkrunResult.findMany.mockResolvedValue([]);
    const result = await exportResultsCsv();
    expect(result).toEqual({ success: false, error: "No results to export" });
  });

  it("exports CSV with correct headers and data", async () => {
    mockAuthenticated();
    mockPrisma.parkrunResult.findMany.mockResolvedValue([
      {
        id: "r1",
        userId: USER_ID,
        date: new Date("2026-04-12"),
        finishTimeSecs: 1500, // 25:00
        ageGradedPct: 65.3,
        location: { name: "Bushy Park" },
      },
      {
        id: "r2",
        userId: USER_ID,
        date: new Date("2026-04-05"),
        finishTimeSecs: 1450, // 24:10
        ageGradedPct: 67.1,
        location: { name: "Richmond Park" },
      },
    ]);

    const result = await exportResultsCsv();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const lines = result.csv.split("\n");
    expect(lines[0]).toBe("Date,Location,Finish Time,Age-Graded %,Personal Best");
    // Results are ordered desc by date (r1 first, r2 second)
    // But PB detection is chronological: r2 (1450) is first PB, r1 (1500) is not
    expect(lines[1]).toContain("2026-04-12");
    expect(lines[1]).toContain("Bushy Park");
    expect(lines[1]).toContain("25:00");
    expect(lines[1]).toContain("65.3");
    expect(lines[1]).toContain("No"); // not a PB

    expect(lines[2]).toContain("2026-04-05");
    expect(lines[2]).toContain("Richmond Park");
    expect(lines[2]).toContain("24:10");
    expect(lines[2]).toContain("67.1");
    expect(lines[2]).toContain("Yes"); // PB
  });

  it("marks personal bests correctly in chronological order", async () => {
    mockAuthenticated();
    // Three results: 30:00, 25:00, 27:00 chronologically
    // PBs: first run (30:00) is initial PB, second (25:00) beats it
    mockPrisma.parkrunResult.findMany.mockResolvedValue([
      {
        id: "r3",
        userId: USER_ID,
        date: new Date("2026-04-19"),
        finishTimeSecs: 1620, // 27:00
        ageGradedPct: null,
        location: { name: "Parkrun A" },
      },
      {
        id: "r2",
        userId: USER_ID,
        date: new Date("2026-04-12"),
        finishTimeSecs: 1500, // 25:00
        ageGradedPct: 65.0,
        location: { name: "Parkrun A" },
      },
      {
        id: "r1",
        userId: USER_ID,
        date: new Date("2026-04-05"),
        finishTimeSecs: 1800, // 30:00
        ageGradedPct: 55.0,
        location: { name: "Parkrun A" },
      },
    ]);

    const result = await exportResultsCsv();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const lines = result.csv.split("\n");
    // desc order: r3, r2, r1
    expect(lines[1]).toContain("No");  // r3 (27:00) - not PB
    expect(lines[2]).toContain("Yes"); // r2 (25:00) - PB
    expect(lines[3]).toContain("Yes"); // r1 (30:00) - initial PB
  });

  it("handles null ageGradedPct", async () => {
    mockAuthenticated();
    mockPrisma.parkrunResult.findMany.mockResolvedValue([
      {
        id: "r1",
        userId: USER_ID,
        date: new Date("2026-04-12"),
        finishTimeSecs: 1500,
        ageGradedPct: null,
        location: { name: "Test Park" },
      },
    ]);

    const result = await exportResultsCsv();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const lines = result.csv.split("\n");
    // AG% should be empty string for null
    expect(lines[1]).toBe("2026-04-12,Test Park,25:00,,Yes");
  });

  it("escapes location names with commas", async () => {
    mockAuthenticated();
    mockPrisma.parkrunResult.findMany.mockResolvedValue([
      {
        id: "r1",
        userId: USER_ID,
        date: new Date("2026-04-12"),
        finishTimeSecs: 1500,
        ageGradedPct: 60.0,
        location: { name: "Park, with comma" },
      },
    ]);

    const result = await exportResultsCsv();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const lines = result.csv.split("\n");
    expect(lines[1]).toContain('"Park, with comma"');
  });

  it("generates correct filename with current date", async () => {
    mockAuthenticated();
    mockPrisma.parkrunResult.findMany.mockResolvedValue([
      {
        id: "r1",
        userId: USER_ID,
        date: new Date("2026-04-12"),
        finishTimeSecs: 1500,
        ageGradedPct: null,
        location: { name: "Test" },
      },
    ]);

    const result = await exportResultsCsv();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.filename).toMatch(/^parkrun-results-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("filters by deletedAt: null", async () => {
    mockAuthenticated();
    mockPrisma.parkrunResult.findMany.mockResolvedValue([]);
    await exportResultsCsv();
    expect(mockPrisma.parkrunResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, deletedAt: null },
      }),
    );
  });
});
