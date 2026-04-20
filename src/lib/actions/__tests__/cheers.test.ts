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

import { toggleCheer, getCheerCount } from "../cheers";

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

describe("toggleCheer", () => {
  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await toggleCheer(RESULT_ID);
    expect(result).toEqual({ success: false, error: "Not authenticated." });
  });

  it("returns error when user has no family", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findFirst.mockResolvedValue(null);
    const result = await toggleCheer(RESULT_ID);
    expect(result).toEqual({ success: false, error: "You must belong to a family." });
  });

  it("creates a new cheer", async () => {
    mockAuthenticated();
    mockFamilyAccess();
    mockPrisma.cheer.findUnique.mockResolvedValue(null);
    mockPrisma.cheer.create.mockResolvedValue({});

    const result = await toggleCheer(RESULT_ID);
    expect(result).toEqual({ success: true, added: true });
    expect(mockPrisma.cheer.create).toHaveBeenCalledWith({
      data: { resultId: RESULT_ID, userId: USER_ID },
    });
  });

  it("removes existing cheer (toggle off)", async () => {
    mockAuthenticated();
    mockFamilyAccess();
    mockPrisma.cheer.findUnique.mockResolvedValue({ id: "ch1", deletedAt: null });
    mockPrisma.cheer.update.mockResolvedValue({});

    const result = await toggleCheer(RESULT_ID);
    expect(result).toEqual({ success: true, added: false });
  });

  it("restores soft-deleted cheer", async () => {
    mockAuthenticated();
    mockFamilyAccess();
    mockPrisma.cheer.findUnique.mockResolvedValue({ id: "ch1", deletedAt: new Date() });
    mockPrisma.cheer.update.mockResolvedValue({});

    const result = await toggleCheer(RESULT_ID);
    expect(result).toEqual({ success: true, added: true });
    expect(mockPrisma.cheer.update).toHaveBeenCalledWith({
      where: { id: "ch1" },
      data: { deletedAt: null },
    });
  });
});

describe("getCheerCount", () => {
  it("returns 0 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await getCheerCount(RESULT_ID);
    expect(result).toEqual({ count: 0, cheered: false });
  });

  it("returns count and user cheer state", async () => {
    mockAuthenticated();
    mockPrisma.cheer.findMany.mockResolvedValue([
      { userId: USER_ID },
      { userId: OTHER_USER_ID },
    ]);

    const result = await getCheerCount(RESULT_ID);
    expect(result).toEqual({ count: 2, cheered: true });
  });

  it("returns cheered=false when user has not cheered", async () => {
    mockAuthenticated();
    mockPrisma.cheer.findMany.mockResolvedValue([
      { userId: OTHER_USER_ID },
    ]);

    const result = await getCheerCount(RESULT_ID);
    expect(result).toEqual({ count: 1, cheered: false });
  });
});
