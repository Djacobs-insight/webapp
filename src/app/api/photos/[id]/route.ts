import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

/**
 * GET /api/photos/[id]
 * SECURITY: Authenticated endpoint to serve photos.
 * Verifies user is the photo owner or can access the result.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: photoId } = await params;
  const userId = session.user.id;

  // SECURITY: Verify user has access to this photo
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: {
      id: true,
      userId: true,
      displayUrl: true,
      thumbnailUrl: true,
    },
  });

  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  // SECURITY: Only owner or family members can view
  const isOwner = photo.userId === userId;
  let isFamilyMember = false;
  if (!isOwner) {
    // Check if the requesting user shares a family with the photo owner
    const sharedMembership = await prisma.familyMember.findFirst({
      where: {
        userId,
        deletedAt: null,
        family: {
          members: {
            some: { userId: photo.userId, deletedAt: null },
          },
        },
      },
    });
    isFamilyMember = !!sharedMembership;
  }

  if (!isOwner && !isFamilyMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // SECURITY: Query param to choose which URL (display or thumbnail)
  const searchParams = request.nextUrl.searchParams;
  const size = searchParams.get("size") || "display";

  const fileUrl = size === "thumbnail" ? photo.thumbnailUrl : photo.displayUrl;

  // SECURITY: Validate the path doesn't escape public/uploads
  if (!fileUrl.startsWith("/uploads/")) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }

  try {
    // Construct safe file path
    const filePath = path.join(process.cwd(), "public", fileUrl);
    const realPath = path.resolve(filePath);
    const publicDir = path.resolve(path.join(process.cwd(), "public", "uploads"));

    // SECURITY: Prevent directory traversal
    if (!realPath.startsWith(publicDir)) {
      return NextResponse.json(
        { error: "Invalid file access" },
        { status: 400 },
      );
    }

    const fileBuffer = await fs.readFile(realPath);
    const ext = path.extname(realPath).toLowerCase();
    const mimeType =
      ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : "image/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving photo:", error);
    return NextResponse.json(
      { error: "Failed to serve photo" },
      { status: 500 },
    );
  }
}
