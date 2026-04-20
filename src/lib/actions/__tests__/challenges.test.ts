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

import {
  createChallenge,
  respondToChallenge,
  getChallenges,
  getChallengeDetail,
  resolveExpiredChallenges,
  getFamilyMembers,
} from "../challenges";

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockAuth = vi.fn();
  vi.clearAllMocks();
});

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const FAMILY_ID = "family-1";
const CHALLENGE_ID = "challenge-1";

function mockAuthenticated(userId = USER_ID) {
  mockAuth.mockResolvedValue({ user: { id: userId } });
}

function mockFamilyMembership(familyId = FAMILY_ID) {
  mockPrisma.familyMember.findFirst.mockResolvedValue({ familyId });
}

describe("createChallenge", () => {
  const validInput = {
    name: "Weekly Run",
    type: "most_runs",
    startsAt: "2026-04-20T00:00:00Z",
    endsAt: "2026-04-27T00:00:00Z",
    invitedUserIds: [OTHER_USER_ID],
  };

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await createChallenge(validInput);
    expect(result).toEqual({ success: false, error: "Not authenticated." });
  });

  it("returns error for invalid input (empty name)", async () => {
    mockAuthenticated();
    const result = await createChallenge({ ...validInput, name: "" });
    expect(result).toEqual({ success: false, error: "Name is required" });
  });

  it("returns error for invalid challenge type", async () => {
    mockAuthenticated();
    const result = await createChallenge({ ...validInput, type: "invalid" });
    expect(result.success).toBe(false);
  });

  it("returns error when end date is before start date", async () => {
    mockAuthenticated();
    mockFamilyMembership();
    const result = await createChallenge({
      ...validInput,
      startsAt: "2026-04-27T00:00:00Z",
      endsAt: "2026-04-20T00:00:00Z",
    });
    expect(result).toEqual({ success: false, error: "End date must be after start date." });
  });

  it("returns error when user has no family", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findFirst.mockResolvedValue(null);
    const result = await createChallenge(validInput);
    expect(result).toEqual({ success: false, error: "You must belong to a family." });
  });

  it("returns error when invitee is not a family member", async () => {
    mockAuthenticated();
    mockFamilyMembership();
    mockPrisma.familyMember.findMany.mockResolvedValue([{ userId: USER_ID }]);
    const result = await createChallenge(validInput);
    expect(result).toEqual({ success: false, error: "All participants must be family members." });
  });

  it("creates challenge successfully", async () => {
    mockAuthenticated();
    mockFamilyMembership();
    mockPrisma.familyMember.findMany.mockResolvedValue([
      { userId: USER_ID },
      { userId: OTHER_USER_ID },
    ]);
    mockPrisma.challenge.create.mockResolvedValue({ id: CHALLENGE_ID });

    const result = await createChallenge(validInput);

    expect(result).toEqual({ success: true, challengeId: CHALLENGE_ID });
    expect(mockPrisma.challenge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Weekly Run",
          type: "most_runs",
          createdById: USER_ID,
          familyId: FAMILY_ID,
        }),
      }),
    );
  });

  it("returns error with no invitees", async () => {
    mockAuthenticated();
    const result = await createChallenge({ ...validInput, invitedUserIds: [] });
    expect(result).toEqual({ success: false, error: "Invite at least one family member" });
  });
});

describe("respondToChallenge", () => {
  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await respondToChallenge(CHALLENGE_ID, true);
    expect(result).toEqual({ success: false, error: "Not authenticated." });
  });

  it("returns error when not a participant", async () => {
    mockAuthenticated();
    mockPrisma.challengeParticipant.findUnique.mockResolvedValue(null);
    const result = await respondToChallenge(CHALLENGE_ID, true);
    expect(result).toEqual({ success: false, error: "You are not invited to this challenge." });
  });

  it("returns error when already responded", async () => {
    mockAuthenticated();
    mockPrisma.challengeParticipant.findUnique.mockResolvedValue({ id: "p1", status: "accepted" });
    const result = await respondToChallenge(CHALLENGE_ID, true);
    expect(result).toEqual({ success: false, error: "Already responded." });
  });

  it("accepts challenge", async () => {
    mockAuthenticated();
    mockPrisma.challengeParticipant.findUnique.mockResolvedValue({ id: "p1", status: "pending" });
    mockPrisma.challengeParticipant.update.mockResolvedValue({});

    const result = await respondToChallenge(CHALLENGE_ID, true);

    expect(result).toEqual({ success: true });
    expect(mockPrisma.challengeParticipant.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "accepted" },
    });
  });

  it("declines challenge", async () => {
    mockAuthenticated();
    mockPrisma.challengeParticipant.findUnique.mockResolvedValue({ id: "p1", status: "pending" });
    mockPrisma.challengeParticipant.update.mockResolvedValue({});

    const result = await respondToChallenge(CHALLENGE_ID, false);

    expect(result).toEqual({ success: true });
    expect(mockPrisma.challengeParticipant.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "declined" },
    });
  });
});

describe("getChallenges", () => {
  it("returns empty when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await getChallenges();
    expect(result).toEqual([]);
  });

  it("returns empty when user has no family", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findFirst.mockResolvedValue(null);
    const result = await getChallenges();
    expect(result).toEqual([]);
  });

  it("returns formatted challenge list", async () => {
    mockAuthenticated();
    mockFamilyMembership();
    mockPrisma.challenge.findMany.mockResolvedValue([
      {
        id: CHALLENGE_ID,
        name: "Weekly Run",
        type: "most_runs",
        status: "active",
        startsAt: new Date("2026-04-20"),
        endsAt: new Date("2026-04-27"),
        winnerId: null,
        createdBy: { name: "Alice" },
        participants: [
          { userId: USER_ID, status: "accepted" },
          { userId: OTHER_USER_ID, status: "pending" },
        ],
      },
    ]);

    const result = await getChallenges();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Weekly Run");
    expect(result[0].participantCount).toBe(1); // only accepted
    expect(result[0].myStatus).toBe("accepted");
    expect(result[0].winnerName).toBeNull();
  });
});

describe("resolveExpiredChallenges", () => {
  it("completes expired challenges and picks winner", async () => {
    mockPrisma.challenge.findMany.mockResolvedValue([
      {
        id: CHALLENGE_ID,
        type: "most_runs",
        startsAt: new Date("2026-04-01"),
        endsAt: new Date("2026-04-14"),
        participants: [
          { userId: USER_ID },
          { userId: OTHER_USER_ID },
        ],
      },
    ]);
    // User 1: 3 runs, User 2: 5 runs
    mockPrisma.parkrunResult.findMany
      .mockResolvedValueOnce([{ finishTimeSecs: 1500 }, { finishTimeSecs: 1600 }, { finishTimeSecs: 1700 }])
      .mockResolvedValueOnce([{ finishTimeSecs: 1500 }, { finishTimeSecs: 1600 }, { finishTimeSecs: 1700 }, { finishTimeSecs: 1800 }, { finishTimeSecs: 1900 }]);
    mockPrisma.challenge.update.mockResolvedValue({});

    await resolveExpiredChallenges();

    expect(mockPrisma.challenge.update).toHaveBeenCalledWith({
      where: { id: CHALLENGE_ID },
      data: { status: "completed", winnerId: OTHER_USER_ID },
    });
  });

  it("sets winnerId to null when no participants have results", async () => {
    mockPrisma.challenge.findMany.mockResolvedValue([
      {
        id: CHALLENGE_ID,
        type: "most_runs",
        startsAt: new Date("2026-04-01"),
        endsAt: new Date("2026-04-14"),
        participants: [{ userId: USER_ID }],
      },
    ]);
    mockPrisma.parkrunResult.findMany.mockResolvedValue([]);
    mockPrisma.challenge.update.mockResolvedValue({});

    await resolveExpiredChallenges();

    expect(mockPrisma.challenge.update).toHaveBeenCalledWith({
      where: { id: CHALLENGE_ID },
      data: { status: "completed", winnerId: null },
    });
  });
});

describe("getFamilyMembers", () => {
  it("returns empty when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await getFamilyMembers();
    expect(result).toEqual([]);
  });

  it("returns other family members excluding self", async () => {
    mockAuthenticated();
    mockFamilyMembership();
    mockPrisma.familyMember.findMany.mockResolvedValue([
      { userId: USER_ID, user: { id: USER_ID, name: "Me" } },
      { userId: OTHER_USER_ID, user: { id: OTHER_USER_ID, name: "Partner" } },
    ]);

    const result = await getFamilyMembers();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ userId: OTHER_USER_ID, name: "Partner" });
  });
});
