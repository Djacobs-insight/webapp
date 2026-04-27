"use server";

import { prisma } from "../prisma";
import { auth } from "../auth/auth";

/**
 * Creates a Photo record with API-based URLs.
 * SECURITY: URLs point to /api/photos/[id] which enforces authentication & authorization.
 */
export async function attachPhoto(
  photoId: string,
  resultId: string,
  originalName: string | null,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false as const, error: "Not authenticated" };
  }

  // Verify the result belongs to this user
  const result = await prisma.parkrunResult.findUnique({
    where: { id: resultId },
    select: { userId: true },
  });
  if (!result || result.userId !== session.user.id) {
    return { success: false as const, error: "Result not found" };
  }

  // SECURITY: Store authenticated API URLs instead of direct file paths
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "";

  const photo = await prisma.photo.create({
    data: {
      resultId,
      userId: session.user.id,
      displayUrl: `${apiBaseUrl}/api/photos/${photoId}?size=display`,
      thumbnailUrl: `${apiBaseUrl}/api/photos/${photoId}?size=thumbnail`,
      originalName,
    },
  });

  return { success: true as const, photoId: photo.id };
}

export async function getPhotosForResult(resultId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.photo.findMany({
    where: { resultId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      displayUrl: true,
      thumbnailUrl: true,
      originalName: true,
      createdAt: true,
    },
  });
}

export async function softDeletePhoto(photoId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Not authenticated" };

  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { userId: true },
  });
  if (!photo || photo.userId !== session.user.id) {
    return { success: false as const, error: "Photo not found" };
  }

  await prisma.photo.update({
    where: { id: photoId },
    data: { deletedAt: new Date() },
  });

  return { success: true as const };
}

export async function restorePhoto(photoId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Not authenticated" };

  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { userId: true },
  });
  if (!photo || photo.userId !== session.user.id) {
    return { success: false as const, error: "Photo not found" };
  }

  await prisma.photo.update({
    where: { id: photoId },
    data: { deletedAt: null },
  });

  return { success: true as const };
}

export type GalleryPhoto = {
  id: string;
  displayUrl: string;
  thumbnailUrl: string;
  originalName: string | null;
  createdAt: Date;
  runnerName: string;
  resultDate: string; // DD/MM/YYYY
  resultId: string;
  isOwn: boolean;
};

export async function getFamilyPhotos(): Promise<GalleryPhoto[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const membership = await prisma.familyMember.findFirst({
    where: { userId: session.user.id, deletedAt: null },
    select: { familyId: true },
  });
  if (!membership) return [];

  const familyMembers = await prisma.familyMember.findMany({
    where: { familyId: membership.familyId, deletedAt: null },
    select: { userId: true },
  });
  const memberIds = familyMembers.map((m) => m.userId);

  const photos = await prisma.photo.findMany({
    where: { userId: { in: memberIds }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true } },
      result: { select: { id: true, date: true } },
    },
  });

  return photos.map((p) => {
    const d = p.result.date;
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    return {
      id: p.id,
      displayUrl: p.displayUrl,
      thumbnailUrl: p.thumbnailUrl,
      originalName: p.originalName,
      createdAt: p.createdAt,
      runnerName: p.user.name ?? "Unknown",
      resultDate: `${dd}/${mm}/${yyyy}`,
      resultId: p.result.id,
      isOwn: p.userId === session.user!.id,
    };
  });
}
