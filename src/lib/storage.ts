import path from "path";
import fs from "fs/promises";
import { BlobServiceClient } from "@azure/storage-blob";

export interface StorageResult {
  displayUrl: string;
  thumbnailUrl: string;
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const AZURE_CONTAINER = "uploads";

function datePath(): string {
  const now = new Date();
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Azure Blob Storage provider — uploads to container 'uploads' at {year}/{month}/
 * Returns /uploads/{year}/{month}/{file} URL paths (served via the auth proxy route).
 */
async function storeImagesAzure(
  displayBuf: Buffer,
  thumbBuf: Buffer,
  baseName: string,
  connStr: string,
): Promise<StorageResult> {
  const sub = datePath();
  const displayFile = `display-${baseName}`;
  const thumbFile = `thumb-${baseName}`;
  const displayBlob = `${sub}/${displayFile}`;
  const thumbBlob = `${sub}/${thumbFile}`;

  const client = BlobServiceClient.fromConnectionString(connStr);
  const container = client.getContainerClient(AZURE_CONTAINER);

  await Promise.all([
    container.getBlockBlobClient(displayBlob).uploadData(displayBuf, {
      blobHTTPHeaders: { blobContentType: "image/jpeg" },
    }),
    container.getBlockBlobClient(thumbBlob).uploadData(thumbBuf, {
      blobHTTPHeaders: { blobContentType: "image/jpeg" },
    }),
  ]);

  return {
    displayUrl: `/uploads/${sub}/${displayFile}`,
    thumbnailUrl: `/uploads/${sub}/${thumbFile}`,
  };
}

/**
 * Local disk storage provider — saves to public/uploads/{year}/{month}/
 * Returns /uploads/{year}/{month}/{file} URL paths.
 */
async function storeImagesLocal(
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

/**
 * Stores images using Azure Blob Storage when AZURE_STORAGE_CONNECTION_STRING is set,
 * falling back to local disk for development.
 */
export async function storeImages(
  displayBuf: Buffer,
  thumbBuf: Buffer,
  baseName: string,
): Promise<StorageResult> {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (connStr) {
    return storeImagesAzure(displayBuf, thumbBuf, baseName, connStr);
  }
  return storeImagesLocal(displayBuf, thumbBuf, baseName);
}

/**
 * Downloads a blob from Azure Blob Storage by its URL path (/uploads/{sub}/{file}).
 * Returns the blob buffer and content type, or null if not found.
 */
export async function readImageFromStorage(
  urlPath: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (connStr) {
    // Strip leading /uploads/ to get the blob name
    const blobName = urlPath.replace(/^\/uploads\//, "");
    const client = BlobServiceClient.fromConnectionString(connStr);
    const container = client.getContainerClient(AZURE_CONTAINER);
    const blob = container.getBlobClient(blobName);

    const download = await blob.download();
    if (!download.readableStreamBody) return null;

    const chunks: Buffer[] = [];
    for await (const chunk of download.readableStreamBody as AsyncIterable<Buffer>) {
      chunks.push(Buffer.from(chunk));
    }
    const contentType = download.contentType ?? "image/jpeg";
    return { buffer: Buffer.concat(chunks), contentType };
  }

  // Local disk
  const filePath = path.join(process.cwd(), "public", urlPath);
  const realPath = path.resolve(filePath);
  const publicDir = path.resolve(path.join(process.cwd(), "public", "uploads"));
  if (!realPath.startsWith(publicDir)) return null;

  const buffer = await fs.readFile(realPath);
  const ext = path.extname(realPath).toLowerCase();
  const contentType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return { buffer, contentType };
}
