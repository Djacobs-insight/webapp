import { describe, it, expect, vi, beforeEach } from "vitest";

let mockPrisma: { user: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } };
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

import { saveOnboardingProfile, getUserHomeEvent } from "../profile";

beforeEach(() => {
  mockPrisma = {
    user: { findUnique: vi.fn(), update: vi.fn() },
  };
  mockAuth = vi.fn();
  vi.clearAllMocks();
});

const USER_ID = "user-1";

function mockAuthenticated(userId = USER_ID) {
  mockAuth.mockResolvedValue({ user: { id: userId } });
}

describe("saveOnboardingProfile", () => {
  it("does nothing when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    await saveOnboardingProfile({ name: "Test" });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("sets onboardingCompleted and name", async () => {
    mockAuthenticated();
    mockPrisma.user.update.mockResolvedValue({});
    await saveOnboardingProfile({ name: "Alice" });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { onboardingCompleted: true, name: "Alice" },
    });
  });

  it("sets birthday as Date object", async () => {
    mockAuthenticated();
    mockPrisma.user.update.mockResolvedValue({});
    await saveOnboardingProfile({ birthday: "1990-05-15" });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { onboardingCompleted: true, birthday: new Date("1990-05-15") },
    });
  });

  it("sets gender when M or F", async () => {
    mockAuthenticated();
    mockPrisma.user.update.mockResolvedValue({});
    await saveOnboardingProfile({ gender: "M" });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { onboardingCompleted: true, gender: "M" },
    });
  });

  it("ignores invalid gender", async () => {
    mockAuthenticated();
    mockPrisma.user.update.mockResolvedValue({});
    await saveOnboardingProfile({ gender: "X" });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { onboardingCompleted: true },
    });
  });

  it("sets parkrunHomeEvent", async () => {
    mockAuthenticated();
    mockPrisma.user.update.mockResolvedValue({});
    await saveOnboardingProfile({ parkrunHomeEvent: "Bushy Park" });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { onboardingCompleted: true, parkrunHomeEvent: "Bushy Park" },
    });
  });

  it("sets all fields at once", async () => {
    mockAuthenticated();
    mockPrisma.user.update.mockResolvedValue({});
    await saveOnboardingProfile({
      name: "Bob",
      birthday: "1985-01-01",
      gender: "F",
      parkrunHomeEvent: "Parkrun HQ",
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: {
        onboardingCompleted: true,
        name: "Bob",
        birthday: new Date("1985-01-01"),
        gender: "F",
        parkrunHomeEvent: "Parkrun HQ",
      },
    });
  });
});

describe("getUserHomeEvent", () => {
  it("returns null when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await getUserHomeEvent();
    expect(result).toBeNull();
  });

  it("returns null when user has no home event", async () => {
    mockAuthenticated();
    mockPrisma.user.findUnique.mockResolvedValue({ parkrunHomeEvent: null });
    const result = await getUserHomeEvent();
    expect(result).toBeNull();
  });

  it("returns home event name", async () => {
    mockAuthenticated();
    mockPrisma.user.findUnique.mockResolvedValue({ parkrunHomeEvent: "Bushy Park" });
    const result = await getUserHomeEvent();
    expect(result).toBe("Bushy Park");
  });
});
