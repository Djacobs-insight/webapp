import { describe, it, expect, vi, beforeEach } from "vitest";

// Ensure photo URL construction does not pick up a developer-local
// NEXT_PUBLIC_API_URL from .env files when these unit tests run.
vi.stubEnv("NEXT_PUBLIC_API_URL", "");

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

import { attachPhoto, getPhotosForResult, softDeletePhoto, restorePhoto, getFamilyPhotos } from "../photos";

beforeEach(() => {
  mockPrisma = {
    parkrunResult: { findUnique: vi.fn() },
    photo: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    familyMember: { findFirst: vi.fn(), findMany: vi.fn() },
  };
  mockAuth = vi.fn();
  vi.clearAllMocks();
});

const USER_ID = "user-1";
const OTHER_USER = "user-2";
const RESULT_ID = "result-1";
const PHOTO_ID = "photo-1";
const FAMILY_ID = "family-1";

function mockAuthenticated(userId = USER_ID) {
  mockAuth.mockResolvedValue({ user: { id: userId } });
}

// ── attachPhoto ───────────────────────────────────────────────────────────

describe("attachPhoto", () => {
  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await attachPhoto("photo-123", RESULT_ID, null);
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns error when result not found", async () => {
    mockAuthenticated();
    mockPrisma.parkrunResult.findUnique.mockResolvedValue(null);
    const result = await attachPhoto("photo-123", RESULT_ID, null);
    expect(result).toEqual({ success: false, error: "Result not found" });
  });

  it("returns error when result belongs to another user", async () => {
    mockAuthenticated();
    mockPrisma.parkrunResult.findUnique.mockResolvedValue({ userId: OTHER_USER });
    const result = await attachPhoto("photo-123", RESULT_ID, null);
    expect(result).toEqual({ success: false, error: "Result not found" });
  });

  it("creates photo and returns photoId", async () => {
    mockAuthenticated();
    mockPrisma.parkrunResult.findUnique.mockResolvedValue({ userId: USER_ID });
    mockPrisma.photo.create.mockResolvedValue({ id: PHOTO_ID });
    const result = await attachPhoto("photo-456", RESULT_ID, "run.jpg");
    expect(result).toEqual({ success: true, photoId: PHOTO_ID });
    expect(mockPrisma.photo.create).toHaveBeenCalledWith({
      data: {
        resultId: RESULT_ID,
        userId: USER_ID,
        displayUrl: "/api/photos/photo-456?size=display",
        thumbnailUrl: "/api/photos/photo-456?size=thumbnail",
        originalName: "run.jpg",
      },
    });
  });
});

// ── getPhotosForResult ────────────────────────────────────────────────────

describe("getPhotosForResult", () => {
  it("returns empty array when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await getPhotosForResult(RESULT_ID);
    expect(result).toEqual([]);
  });

  it("returns photos filtered by deletedAt null", async () => {
    mockAuthenticated();
    const createdAt = new Date();
    const photos = [{ id: PHOTO_ID, originalName: null, createdAt }];
    mockPrisma.photo.findMany.mockResolvedValue(photos);
    const result = await getPhotosForResult(RESULT_ID);
    expect(result).toEqual([
      {
        id: PHOTO_ID,
        originalName: null,
        createdAt,
        displayUrl: `/api/photos/${PHOTO_ID}?size=display`,
        thumbnailUrl: `/api/photos/${PHOTO_ID}?size=thumbnail`,
      },
    ]);
    expect(mockPrisma.photo.findMany).toHaveBeenCalledWith({
      where: { resultId: RESULT_ID, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, originalName: true, createdAt: true },
    });
  });
});

// ── softDeletePhoto ───────────────────────────────────────────────────────

describe("softDeletePhoto", () => {
  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await softDeletePhoto(PHOTO_ID);
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns error when photo not found", async () => {
    mockAuthenticated();
    mockPrisma.photo.findUnique.mockResolvedValue(null);
    const result = await softDeletePhoto(PHOTO_ID);
    expect(result).toEqual({ success: false, error: "Photo not found" });
  });

  it("returns error when photo belongs to another user", async () => {
    mockAuthenticated();
    mockPrisma.photo.findUnique.mockResolvedValue({ userId: OTHER_USER });
    const result = await softDeletePhoto(PHOTO_ID);
    expect(result).toEqual({ success: false, error: "Photo not found" });
  });

  it("soft-deletes own photo", async () => {
    mockAuthenticated();
    mockPrisma.photo.findUnique.mockResolvedValue({ userId: USER_ID });
    mockPrisma.photo.update.mockResolvedValue({});
    const result = await softDeletePhoto(PHOTO_ID);
    expect(result).toEqual({ success: true });
    expect(mockPrisma.photo.update).toHaveBeenCalledWith({
      where: { id: PHOTO_ID },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

// ── restorePhoto ──────────────────────────────────────────────────────────

describe("restorePhoto", () => {
  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await restorePhoto(PHOTO_ID);
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns error when photo belongs to another user", async () => {
    mockAuthenticated();
    mockPrisma.photo.findUnique.mockResolvedValue({ userId: OTHER_USER });
    const result = await restorePhoto(PHOTO_ID);
    expect(result).toEqual({ success: false, error: "Photo not found" });
  });

  it("restores own photo by clearing deletedAt", async () => {
    mockAuthenticated();
    mockPrisma.photo.findUnique.mockResolvedValue({ userId: USER_ID });
    mockPrisma.photo.update.mockResolvedValue({});
    const result = await restorePhoto(PHOTO_ID);
    expect(result).toEqual({ success: true });
    expect(mockPrisma.photo.update).toHaveBeenCalledWith({
      where: { id: PHOTO_ID },
      data: { deletedAt: null },
    });
  });
});

// ── getFamilyPhotos ───────────────────────────────────────────────────────

describe("getFamilyPhotos", () => {
  it("returns empty array when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await getFamilyPhotos();
    expect(result).toEqual([]);
  });

  it("returns empty array when user has no family", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findFirst.mockResolvedValue(null);
    const result = await getFamilyPhotos();
    expect(result).toEqual([]);
  });

  it("returns formatted family photos with runner info", async () => {
    mockAuthenticated();
    mockPrisma.familyMember.findFirst.mockResolvedValue({ familyId: FAMILY_ID });
    mockPrisma.familyMember.findMany.mockResolvedValue([
      { userId: USER_ID },
      { userId: OTHER_USER },
    ]);
    const createdAt = new Date("2025-03-15T10:00:00Z");
    mockPrisma.photo.findMany.mockResolvedValue([
      {
        id: PHOTO_ID,
        displayUrl: "/d.jpg",
        thumbnailUrl: "/t.jpg",
        originalName: "run.jpg",
        createdAt,
        userId: OTHER_USER,
        user: { name: "Bob" },
        result: { id: RESULT_ID, date: new Date("2025-03-15T00:00:00Z") },
      },
    ]);
    const result = await getFamilyPhotos();
    expect(result).toEqual([
      {
        id: PHOTO_ID,
        displayUrl: `/api/photos/${PHOTO_ID}?size=display`,
        thumbnailUrl: `/api/photos/${PHOTO_ID}?size=thumbnail`,
        originalName: "run.jpg",
        createdAt,
        runnerName: "Bob",
        resultDate: "15/03/2025",
        resultId: RESULT_ID,
        isOwn: false,
      },
    ]);
  });
});
