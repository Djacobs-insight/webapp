import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import crypto from "crypto";
import { auth } from "@/lib/auth/auth";
import { storeImages } from "@/lib/storage";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const DISPLAY_WIDTH = 800;
const THUMB_WIDTH = 200;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, and WebP images are allowed" },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File must be smaller than 10 MB" },
      { status: 400 },
    );
  }

  const arrayBuf = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);

  // Generate unique filename
  const ext = file.type === "image/png" ? "png" : "jpg";
  const hash = crypto.randomBytes(8).toString("hex");
  const baseName = `${hash}.${ext}`;

  // Resize with sharp
  const outputFormat = ext === "png" ? "png" : "jpeg";
  const [displayBuf, thumbBuf] = await Promise.all([
    sharp(buffer).resize(DISPLAY_WIDTH, undefined, { withoutEnlargement: true })[outputFormat]({ quality: 80 }).toBuffer(),
    sharp(buffer).resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })[outputFormat]({ quality: 70 }).toBuffer(),
  ]);

  const { displayUrl, thumbnailUrl } = await storeImages(displayBuf, thumbBuf, baseName);

  return NextResponse.json({ displayUrl, thumbnailUrl, originalName: file.name });
}
