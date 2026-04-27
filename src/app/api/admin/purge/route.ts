import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import { timingSafeEqual } from "crypto";

const RETENTION_DAYS = 30;

/**
 * POST /api/admin/purge
 * Hard-deletes all soft-deleted records past the retention period.
 * Protected by bearer token (ADMIN_PURGE_TOKEN env var).
 * Callable by Azure scheduled task or manually.
 */
export async function POST(request: Request) {
  // Validate bearer token using timing-safe comparison (SECURITY: fix timing attack)
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.ADMIN_PURGE_TOKEN;
  if (!expectedToken) {
    return NextResponse.json(
      { error: "ADMIN_PURGE_TOKEN not configured" },
      { status: 500 },
    );
  }

  try {
    const providedToken = authHeader?.replace("Bearer ", "") ?? "";
    if (!timingSafeEqual(Buffer.from(providedToken), Buffer.from(expectedToken))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch {
    // timingSafeEqual throws if buffer lengths differ — treat as unauthorized
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const counts: Record<string, number> = {};

  // Collect photo URLs before deleting for file cleanup
  const expiredPhotos = await prisma.photo.findMany({
    where: { deletedAt: { not: null, lte: cutoff } },
    select: { id: true, displayUrl: true, thumbnailUrl: true },
  });

  // Hard-delete in dependency order (children first)
  const cheers = await prisma.cheer.deleteMany({
    where: { deletedAt: { not: null, lte: cutoff } },
  });
  counts.cheers = cheers.count;

  const reactions = await prisma.reaction.deleteMany({
    where: { deletedAt: { not: null, lte: cutoff } },
  });
  counts.reactions = reactions.count;

  const comments = await prisma.comment.deleteMany({
    where: { deletedAt: { not: null, lte: cutoff } },
  });
  counts.comments = comments.count;

  const photos = await prisma.photo.deleteMany({
    where: { deletedAt: { not: null, lte: cutoff } },
  });
  counts.photos = photos.count;

  const badges = await prisma.userBadge.deleteMany({
    where: { deletedAt: { not: null, lte: cutoff } },
  });
  counts.badges = badges.count;

  const milestones = await prisma.milestone.deleteMany({
    where: { deletedAt: { not: null, lte: cutoff } },
  });
  counts.milestones = milestones.count;

  const challengeParticipants = await prisma.challengeParticipant.deleteMany({
    where: { deletedAt: { not: null, lte: cutoff } },
  });
  counts.challengeParticipants = challengeParticipants.count;

  const challenges = await prisma.challenge.deleteMany({
    where: { deletedAt: { not: null, lte: cutoff } },
  });
  counts.challenges = challenges.count;

  const results = await prisma.parkrunResult.deleteMany({
    where: { deletedAt: { not: null, lte: cutoff } },
  });
  counts.results = results.count;

  const familyMembers = await prisma.familyMember.deleteMany({
    where: { deletedAt: { not: null, lte: cutoff } },
  });
  counts.familyMembers = familyMembers.count;

  const users = await prisma.user.deleteMany({
    where: { deletedAt: { not: null, lte: cutoff } },
  });
  counts.users = users.count;

  // Clean up photo files from local storage
  let filesRemoved = 0;
  for (const photo of expiredPhotos) {
    for (const url of [photo.displayUrl, photo.thumbnailUrl]) {
      if (url.startsWith("/uploads/")) {
        const filePath = path.join(process.cwd(), "public", url);
        try {
          await fs.unlink(filePath);
          filesRemoved++;
        } catch {
          // File may already be removed
        }
      }
    }
  }
  counts.filesRemoved = filesRemoved;

  console.log("[purge] Hard-deleted records:", counts);

  return NextResponse.json({
    success: true,
    purgedAt: new Date().toISOString(),
    retentionDays: RETENTION_DAYS,
    counts,
  });
}
