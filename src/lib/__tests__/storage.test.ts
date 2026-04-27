import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMkdir = vi.fn();
const mockWriteFile = vi.fn();

vi.mock("fs/promises", () => ({
  default: {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
  },
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

import { storeImages } from "../storage";

beforeEach(() => {
  vi.clearAllMocks();
  mockMkdir.mockResolvedValue(undefined);
  mockWriteFile.mockResolvedValue(undefined);
});

describe("storeImages", () => {
  it("creates directory with recursive option", async () => {
    await storeImages(Buffer.from("display"), Buffer.from("thumb"), "abc123.jpg");
    expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining("uploads"), { recursive: true });
  });

  it("writes display and thumbnail files", async () => {
    const displayBuf = Buffer.from("display-data");
    const thumbBuf = Buffer.from("thumb-data");
    await storeImages(displayBuf, thumbBuf, "abc123.jpg");
    expect(mockWriteFile).toHaveBeenCalledTimes(2);
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining("display-abc123.jpg"),
      displayBuf,
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining("thumb-abc123.jpg"),
      thumbBuf,
    );
  });

  it("returns public URLs with year/month path", async () => {
    const result = await storeImages(Buffer.from("d"), Buffer.from("t"), "test.jpg");
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    expect(result.displayUrl).toBe(`/uploads/${year}/${month}/display-test.jpg`);
    expect(result.thumbnailUrl).toBe(`/uploads/${year}/${month}/thumb-test.jpg`);
  });
});
