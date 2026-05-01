import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers";

let mockPrisma: MockPrisma & {
  family: { create: ReturnType<typeof vi.fn> };
  invite: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  familyMember: MockPrisma["familyMember"] & {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};
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

vi.mock("../../freemium", () => ({
  FREE_MEMBER_LIMIT: 3,
  isFamilyAtLimit: vi.fn(),
}));

import { createFamily, createInvite, acceptInvite, removeMember } from "../family";
import { isFamilyAtLimit } from "../../freemium";

const mockIsFamilyAtLimit = isFamilyAtLimit as ReturnType<typeof vi.fn>;

beforeEach(() => {
  const base = createMockPrisma();
  mockPrisma = {
    ...base,
    family: { create: vi.fn() },
    invite: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    familyMember: {
      ...base.familyMember,
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  mockAuth = vi.fn();
  vi.clearAllMocks();
});

const USER_ID = "user-1";
const FAMILY_ID = "family-1";

function mockAuthenticated(userId = USER_ID) {
  mockAuth.mockResolvedValue({ user: { id: userId } });
}

// ── createFamily ──────────────────────────────────────────────────────────

describe("createFamily", () => {
  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await createFamily({ name: "Test Family" });
    expect(result).toEqual({ success: false, error: "Not authenticated." });
  });

  it("returns error for invalid name (too short)", async () => {
    mockAuthenticated();
    const result = await createFamily({ name: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/at least 2 characters/);
    }
  });

  it("returns error when user already in a family", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findFirst.mockResolvedValue({ familyId: FAMILY_ID, family: { id: FAMILY_ID } });
    const result = await createFamily({ name: "New Family" });
    expect(result).toEqual({ success: false, error: "You are already a member of a family group." });
  });

  it("creates family and adds creator as admin", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findFirst.mockResolvedValue(null);
    mockPrisma.family.create.mockResolvedValue({ id: FAMILY_ID });
    const result = await createFamily({ name: "Smith Family" });
    expect(result).toEqual({ success: true, familyId: FAMILY_ID });
    expect(mockPrisma.family.create).toHaveBeenCalledWith({
      data: {
        name: "Smith Family",
        members: { create: { userId: USER_ID, role: "admin" } },
      },
    });
  });
});

// ── createInvite ──────────────────────────────────────────────────────────

describe("createInvite", () => {
  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await createInvite({ familyId: FAMILY_ID, appUrl: "http://localhost" });
    expect(result).toEqual({ success: false, error: "Not authenticated." });
  });

  it("returns error when family is at limit", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findFirst.mockResolvedValue({ id: "fm-1" });
    mockIsFamilyAtLimit.mockResolvedValue(true);
    const result = await createInvite({ familyId: FAMILY_ID, appUrl: "http://localhost" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/Free plan/);
  });

  it("creates invite and returns URL with token", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findFirst.mockResolvedValue({ id: "fm-1" });
    mockIsFamilyAtLimit.mockResolvedValue(false);
    mockPrisma.invite.create.mockResolvedValue({});
    const result = await createInvite({ familyId: FAMILY_ID, appUrl: "http://localhost:3000" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.inviteUrl).toMatch(/^http:\/\/localhost:3000\/invite\//);
      expect(result.token).toBeTruthy();
    }
  });
});

// ── acceptInvite ──────────────────────────────────────────────────────────

describe("acceptInvite", () => {
  const validInvite = {
    id: "invite-1",
    token: "valid-token",
    familyId: FAMILY_ID,
    usedAt: null,
    expiresAt: new Date(Date.now() + 86400000),
    family: { name: "Test Family" },
  };

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await acceptInvite({ token: "valid-token" });
    expect(result).toEqual({ success: false, error: "Not authenticated." });
  });

  it("returns error for invalid token", async () => {
    mockAuthenticated();
    mockPrisma.invite.findUnique.mockResolvedValue(null);
    const result = await acceptInvite({ token: "bad-token" });
    expect(result).toEqual({ success: false, error: "Invite link is invalid." });
  });

  it("allows reuse: previously used invite still accepts new members", async () => {
    mockAuthenticated();
    mockPrisma.invite.findUnique.mockResolvedValue({ ...validInvite, usedAt: new Date() });
    mockIsFamilyAtLimit.mockResolvedValue(false);
    mockPrisma.familyMember.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockResolvedValue([]);
    const result = await acceptInvite({ token: "valid-token" });
    expect(result).toEqual({ success: true, familyId: FAMILY_ID, familyName: "Test Family" });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("returns error when invite expired", async () => {
    mockAuthenticated();
    mockPrisma.invite.findUnique.mockResolvedValue({
      ...validInvite,
      expiresAt: new Date(Date.now() - 86400000),
    });
    const result = await acceptInvite({ token: "valid-token" });
    expect(result).toEqual({ success: false, error: "This invite has expired." });
  });

  it("returns error when family at limit", async () => {
    mockAuthenticated();
    mockPrisma.invite.findUnique.mockResolvedValue(validInvite);
    mockIsFamilyAtLimit.mockResolvedValue(true);
    const result = await acceptInvite({ token: "valid-token" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/free limit/);
  });

  it("returns error when already a member", async () => {
    mockAuthenticated();
    mockPrisma.invite.findUnique.mockResolvedValue(validInvite);
    mockIsFamilyAtLimit.mockResolvedValue(false);
    mockPrisma.familyMember.findFirst.mockResolvedValue({ familyId: FAMILY_ID });
    const result = await acceptInvite({ token: "valid-token" });
    expect(result).toEqual({ success: false, error: "You are already a member of this family." });
  });

  it("accepts invite, marks used, adds member in transaction", async () => {
    mockAuthenticated();
    mockPrisma.invite.findUnique.mockResolvedValue(validInvite);
    mockIsFamilyAtLimit.mockResolvedValue(false);
    mockPrisma.familyMember.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockResolvedValue([]);
    const result = await acceptInvite({ token: "valid-token" });
    expect(result).toEqual({ success: true, familyId: FAMILY_ID, familyName: "Test Family" });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});

// ── removeMember ──────────────────────────────────────────────────────────

describe("removeMember", () => {
  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await removeMember({ familyMemberId: "member-1" });
    expect(result).toEqual({ success: false, error: "Not authenticated." });
  });

  it("returns error when member not found", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findUnique.mockResolvedValue(null);
    const result = await removeMember({ familyMemberId: "bad-id" });
    expect(result).toEqual({ success: false, error: "Member not found." });
  });

  it("returns error when member already deleted", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findUnique.mockResolvedValue({
      id: "member-1",
      userId: "other-user",
      familyId: FAMILY_ID,
      deletedAt: new Date(),
    });
    const result = await removeMember({ familyMemberId: "member-1" });
    expect(result).toEqual({ success: false, error: "Member not found." });
  });

  it("returns error when not admin and not self", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findUnique.mockResolvedValue({
      id: "member-2",
      userId: "other-user",
      familyId: FAMILY_ID,
      deletedAt: null,
    });
    mockPrisma.familyMember.findFirst.mockResolvedValue({
      userId: USER_ID,
      familyId: FAMILY_ID,
      role: "member",
    });
    const result = await removeMember({ familyMemberId: "member-2" });
    expect(result).toEqual({ success: false, error: "Not authorised to remove this member." });
  });

  it("allows self-removal", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findUnique.mockResolvedValue({
      id: "member-1",
      userId: USER_ID,
      familyId: FAMILY_ID,
      deletedAt: null,
    });
    mockPrisma.familyMember.findFirst.mockResolvedValue({
      userId: USER_ID,
      familyId: FAMILY_ID,
      role: "member",
    });
    mockPrisma.familyMember.update.mockResolvedValue({});
    const result = await removeMember({ familyMemberId: "member-1" });
    expect(result).toEqual({ success: true });
  });

  it("allows admin to remove another member", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findUnique.mockResolvedValue({
      id: "member-2",
      userId: "other-user",
      familyId: FAMILY_ID,
      deletedAt: null,
    });
    mockPrisma.familyMember.findFirst.mockResolvedValue({
      userId: USER_ID,
      familyId: FAMILY_ID,
      role: "admin",
    });
    mockPrisma.familyMember.update.mockResolvedValue({});
    const result = await removeMember({ familyMemberId: "member-2" });
    expect(result).toEqual({ success: true });
    expect(mockPrisma.familyMember.update).toHaveBeenCalledWith({
      where: { id: "member-2" },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
