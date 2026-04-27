import { describe, it, expect, vi, beforeEach } from "vitest";

let mockAuth: ReturnType<typeof vi.fn>;
const mockStoreImages = vi.fn();

vi.mock("@/lib/auth/auth", () => ({
  get auth() {
    return mockAuth;
  },
}));

vi.mock("@/lib/storage", () => ({
  storeImages: (...args: unknown[]) => mockStoreImages(...args),
}));

vi.mock("sharp", () => {
  const chainable = () => ({
    resize: chainable,
    jpeg: chainable,
    png: chainable,
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("resized")),
  });
  return { default: chainable };
});

import { POST } from "../route";
import { NextRequest } from "next/server";

beforeEach(() => {
  mockAuth = vi.fn();
  vi.clearAllMocks();
});

const USER_ID = "user-1";

function mockAuthenticated() {
  mockAuth.mockResolvedValue({ user: { id: USER_ID } });
}

function createFileRequest(
  name: string,
  type: string,
  content: string | Uint8Array = "fake-image-data",
): NextRequest {
  const blob = new Blob([content as BlobPart], { type });
  const file = new File([blob], name, { type });
  const formData = new FormData();
  formData.append("file", file);
  return new NextRequest("http://localhost:3000/api/upload", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/upload", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const request = createFileRequest("photo.jpg", "image/jpeg");
    const response = await POST(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 400 when no file provided", async () => {
    mockAuthenticated();
    const formData = new FormData();
    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("No file provided");
  });

  it("returns 400 for disallowed file type", async () => {
    mockAuthenticated();
    const request = createFileRequest("doc.pdf", "application/pdf");
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/JPEG, PNG, and WebP/);
  });

  it("returns 400 when file exceeds 10 MB", async () => {
    mockAuthenticated();
    const bigContent = Buffer.alloc(11 * 1024 * 1024, "x");
    const request = createFileRequest("big.jpg", "image/jpeg", bigContent);
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/10 MB/);
  });

  it("returns 200 with URLs for valid JPEG upload", async () => {
    mockAuthenticated();
    mockStoreImages.mockResolvedValue({
      displayUrl: "/uploads/2025/03/display-abc.jpg",
      thumbnailUrl: "/uploads/2025/03/thumb-abc.jpg",
    });
    const request = createFileRequest("photo.jpg", "image/jpeg");
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.displayUrl).toBe("/uploads/2025/03/display-abc.jpg");
    expect(body.thumbnailUrl).toBe("/uploads/2025/03/thumb-abc.jpg");
    expect(body.originalName).toBe("photo.jpg");
  });

  it("accepts PNG files", async () => {
    mockAuthenticated();
    mockStoreImages.mockResolvedValue({
      displayUrl: "/uploads/2025/03/display-abc.png",
      thumbnailUrl: "/uploads/2025/03/thumb-abc.png",
    });
    const request = createFileRequest("photo.png", "image/png");
    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it("accepts WebP files", async () => {
    mockAuthenticated();
    mockStoreImages.mockResolvedValue({
      displayUrl: "/uploads/2025/03/display-abc.jpg",
      thumbnailUrl: "/uploads/2025/03/thumb-abc.jpg",
    });
    const request = createFileRequest("photo.webp", "image/webp");
    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
