import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
const mockPrisma = {
  photo: { findMany: vi.fn(), deleteMany: vi.fn() },
  cheer: { deleteMany: vi.fn() },
  reaction: { deleteMany: vi.fn() },
  comment: { deleteMany: vi.fn() },
  userBadge: { deleteMany: vi.fn() },
  milestone: { deleteMany: vi.fn() },
  challengeParticipant: { deleteMany: vi.fn() },
  challenge: { deleteMany: vi.fn() },
  parkrunResult: { deleteMany: vi.fn() },
  familyMember: { deleteMany: vi.fn() },
  user: { deleteMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

// Mock fs
const mockUnlink = vi.fn();
vi.mock("fs/promises", () => ({
  default: { unlink: (...args: unknown[]) => mockUnlink(...args) },
  unlink: (...args: unknown[]) => mockUnlink(...args),
}));

import { POST } from "../route";

const PURGE_TOKEN = "test-secret-token";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_PURGE_TOKEN = PURGE_TOKEN;

  // Default: all deletions return 0
  for (const model of Object.values(mockPrisma)) {
    if ("deleteMany" in model) {
      (model.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    }
    if ("findMany" in model) {
      (model.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    }
  }
  mockUnlink.mockResolvedValue(undefined);
});

function makeRequest(token?: string): Request {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request("http://localhost/api/admin/purge", {
    method: "POST",
    headers,
  });
}

describe("POST /api/admin/purge", () => {
  it("returns 401 when no auth header provided", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when wrong token provided", async () => {
    const res = await POST(makeRequest("wrong-token"));
    expect(res.status).toBe(401);
  });

  it("returns 500 when ADMIN_PURGE_TOKEN is not configured", async () => {
    delete process.env.ADMIN_PURGE_TOKEN;
    const res = await POST(makeRequest(PURGE_TOKEN));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("ADMIN_PURGE_TOKEN not configured");
  });

  it("returns 200 with counts on successful purge", async () => {
    mockPrisma.cheer.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.comment.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.user.deleteMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeRequest(PURGE_TOKEN));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.counts.cheers).toBe(3);
    expect(body.counts.comments).toBe(2);
    expect(body.counts.users).toBe(1);
    expect(body.retentionDays).toBe(30);
  });

  it("deletes in correct order (children before parents)", async () => {
    const callOrder: string[] = [];
    mockPrisma.cheer.deleteMany.mockImplementation(() => { callOrder.push("cheer"); return { count: 0 }; });
    mockPrisma.reaction.deleteMany.mockImplementation(() => { callOrder.push("reaction"); return { count: 0 }; });
    mockPrisma.comment.deleteMany.mockImplementation(() => { callOrder.push("comment"); return { count: 0 }; });
    mockPrisma.photo.deleteMany.mockImplementation(() => { callOrder.push("photo"); return { count: 0 }; });
    mockPrisma.userBadge.deleteMany.mockImplementation(() => { callOrder.push("userBadge"); return { count: 0 }; });
    mockPrisma.milestone.deleteMany.mockImplementation(() => { callOrder.push("milestone"); return { count: 0 }; });
    mockPrisma.challengeParticipant.deleteMany.mockImplementation(() => { callOrder.push("challengeParticipant"); return { count: 0 }; });
    mockPrisma.challenge.deleteMany.mockImplementation(() => { callOrder.push("challenge"); return { count: 0 }; });
    mockPrisma.parkrunResult.deleteMany.mockImplementation(() => { callOrder.push("parkrunResult"); return { count: 0 }; });
    mockPrisma.familyMember.deleteMany.mockImplementation(() => { callOrder.push("familyMember"); return { count: 0 }; });
    mockPrisma.user.deleteMany.mockImplementation(() => { callOrder.push("user"); return { count: 0 }; });

    await POST(makeRequest(PURGE_TOKEN));

    // user should be last
    expect(callOrder.indexOf("user")).toBeGreaterThan(callOrder.indexOf("parkrunResult"));
    expect(callOrder.indexOf("parkrunResult")).toBeGreaterThan(callOrder.indexOf("cheer"));
  });

  it("uses correct cutoff date filter (30 days)", async () => {
    await POST(makeRequest(PURGE_TOKEN));

    // Every deleteMany should filter deletedAt: { not: null, lte: cutoff }
    expect(mockPrisma.cheer.deleteMany).toHaveBeenCalledWith({
      where: { deletedAt: { not: null, lte: expect.any(Date) } },
    });
  });

  it("cleans up photo files from local storage", async () => {
    mockPrisma.photo.findMany.mockResolvedValue([
      {
        id: "p1",
        displayUrl: "/uploads/2026/04/display-abc.jpg",
        thumbnailUrl: "/uploads/2026/04/thumb-abc.jpg",
      },
    ]);

    await POST(makeRequest(PURGE_TOKEN));

    expect(mockUnlink).toHaveBeenCalledTimes(2);
    expect(mockUnlink).toHaveBeenCalledWith(
      expect.stringContaining("display-abc.jpg"),
    );
    expect(mockUnlink).toHaveBeenCalledWith(
      expect.stringContaining("thumb-abc.jpg"),
    );
  });

  it("does not fail if photo files are already removed", async () => {
    mockPrisma.photo.findMany.mockResolvedValue([
      {
        id: "p1",
        displayUrl: "/uploads/2026/04/display-gone.jpg",
        thumbnailUrl: "/uploads/2026/04/thumb-gone.jpg",
      },
    ]);
    mockUnlink.mockRejectedValue(new Error("ENOENT"));

    const res = await POST(makeRequest(PURGE_TOKEN));
    expect(res.status).toBe(200);
  });
});
