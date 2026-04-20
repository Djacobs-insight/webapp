"use server";

import { prisma } from "../prisma";
import { auth } from "../auth/auth";
import { BADGE_DEFINITIONS } from "../badge-definitions";
import type { BadgeDefinition } from "../badge-definitions";

export type BadgeInfo = {
  key: string;
  name: string;
  label: string;
};

/**
 * Detect and award any newly-earned badges after a result submission.
 * Returns the list of newly awarded badges.
 */
export async function detectBadges(
  userId: string,
  resultId: string,
  finishTimeSecs: number,
  ageGradedPct: number | null,
): Promise<BadgeInfo[]> {
  const newBadges: BadgeInfo[] = [];
  const stats = await getUserBadgeStats(userId);

  for (const badge of BADGE_DEFINITIONS) {
    if (isCriteriaMet(badge, stats, finishTimeSecs, ageGradedPct)) {
      const exists = await prisma.userBadge.findUnique({
        where: { userId_badgeKey: { userId, badgeKey: badge.key } },
      });
      if (!exists) {
        await prisma.userBadge.create({
          data: { userId, badgeKey: badge.key, resultId },
        });
        newBadges.push({
          key: badge.key,
          name: badge.name,
          label: `Badge unlocked: ${badge.name}!`,
        });
      }
    }
  }

  return newBadges;
}

async function getUserBadgeStats(userId: string) {
  const [runCount, fastestResult, bestAgResult, photoCount, commentCount, results] =
    await Promise.all([
      prisma.parkrunResult.count({ where: { userId } }),
      prisma.parkrunResult.findFirst({
        where: { userId },
        orderBy: { finishTimeSecs: "asc" },
        select: { finishTimeSecs: true },
      }),
      prisma.parkrunResult.findFirst({
        where: { userId, ageGradedPct: { not: null } },
        orderBy: { ageGradedPct: "desc" },
        select: { ageGradedPct: true },
      }),
      prisma.photo.count({ where: { userId, deletedAt: null } }),
      prisma.comment.count({ where: { userId, deletedAt: null } }),
      prisma.parkrunResult.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        select: { date: true },
        take: 52, // max streak we'd care about
      }),
    ]);

  return {
    runCount,
    fastestTime: fastestResult?.finishTimeSecs ?? null,
    bestAgeGrade: bestAgResult?.ageGradedPct ?? null,
    photoCount,
    commentCount,
    weekStreak: calculateWeekStreak(results.map((r) => r.date)),
  };
}

function calculateWeekStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;

  // Normalize dates to week numbers, deduplicate
  const weeks = new Set<number>();
  for (const d of dates) {
    const epoch = new Date("2020-01-06"); // a Monday
    const diffMs = d.getTime() - epoch.getTime();
    const weekNum = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    weeks.add(weekNum);
  }

  const sorted = Array.from(weeks).sort((a, b) => b - a); // descending
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] - sorted[i] === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function isCriteriaMet(
  badge: BadgeDefinition,
  stats: Awaited<ReturnType<typeof getUserBadgeStats>>,
  finishTimeSecs: number,
  ageGradedPct: number | null,
): boolean {
  const c = badge.criteria;
  switch (c.type) {
    case "run_count":
      return stats.runCount >= c.count;
    case "finish_time_under":
      return finishTimeSecs < c.seconds;
    case "age_grade_above":
      return ageGradedPct != null && ageGradedPct >= c.percentage;
    case "streak_days":
      return stats.weekStreak >= c.count;
    case "photos_uploaded":
      return stats.photoCount >= c.count;
    case "comments_given":
      return stats.commentCount >= c.count;
  }
}

export type UserBadgeDisplay = {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  earned: boolean;
  awardedAt: string | null;
  progressHint: string | null;
};

/**
 * Get all badges for a user with earned/unearned status and progress hints.
 */
export async function getUserBadges(userId?: string): Promise<UserBadgeDisplay[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const targetUserId = userId ?? session.user.id;

  // If viewing another user's badges, verify they're in the same family
  if (targetUserId !== session.user.id) {
    const viewerMembership = await prisma.familyMember.findFirst({
      where: { userId: session.user.id, deletedAt: null },
      select: { familyId: true },
    });
    const targetMembership = await prisma.familyMember.findFirst({
      where: { userId: targetUserId, deletedAt: null },
      select: { familyId: true },
    });
    if (!viewerMembership || !targetMembership || viewerMembership.familyId !== targetMembership.familyId) {
      return [];
    }
  }

  const [earnedBadges, stats] = await Promise.all([
    prisma.userBadge.findMany({
      where: { userId: targetUserId },
      select: { badgeKey: true, awardedAt: true },
    }),
    getUserBadgeStats(targetUserId),
  ]);

  const earnedMap = new Map(earnedBadges.map((b) => [b.badgeKey, b.awardedAt]));

  // Import getProgressHint dynamically to avoid issues with "use server"
  const { getProgressHint } = await import("../badge-definitions");

  return BADGE_DEFINITIONS.map((badge) => {
    const awardedAt = earnedMap.get(badge.key);
    const earned = !!awardedAt;
    return {
      key: badge.key,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      category: badge.category,
      earned,
      awardedAt: awardedAt?.toISOString() ?? null,
      progressHint: earned ? null : getProgressHint(badge, stats),
    };
  });
}

/**
 * Get family members who have earned a specific badge.
 */
export async function getBadgeFamilyHolders(badgeKey: string): Promise<{ userId: string; name: string; awardedAt: string }[]> {
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

  const holders = await prisma.userBadge.findMany({
    where: { badgeKey, userId: { in: memberIds } },
    include: { user: { select: { name: true } } },
    orderBy: { awardedAt: "asc" },
  });

  return holders.map((h) => ({
    userId: h.userId,
    name: h.user.name ?? "Unknown",
    awardedAt: h.awardedAt.toISOString(),
  }));
}
