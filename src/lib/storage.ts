import path from "path";
import fs from "fs/promises";

export interface StorageResult {
  displayUrl: string;
  thumbnailUrl: string;
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

function datePath(): string {
  const now = new Date();
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Local disk storage provider — saves to public/uploads/{year}/{month}/
 * Returns public-accessible URLs.
 */
export async function storeImages(
  displayBuf: Buffer,
  thumbBuf: Buffer,
  baseName: string,
): Promise<StorageResult> {
  const sub = datePath();
  const dir = path.join(UPLOAD_DIR, sub);
  await fs.mkdir(dir, { recursive: true });

  const displayFile = `display-${baseName}`;
  const thumbFile = `thumb-${baseName}`;

  await Promise.all([
    fs.writeFile(path.join(dir, displayFile), displayBuf),
    fs.writeFile(path.join(dir, thumbFile), thumbBuf),
  ]);

  return {
    displayUrl: `/uploads/${sub}/${displayFile}`,
    thumbnailUrl: `/uploads/${sub}/${thumbFile}`,
  };
}
