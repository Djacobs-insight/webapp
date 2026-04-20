"use server";

import { prisma } from "../prisma";
import { auth } from "../auth/auth";

export type ToggleCheerResult =
  | { success: true; added: boolean }
  | { success: false; error: string };

export async function toggleCheer(resultId: string): Promise<ToggleCheerResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated." };
  }
  const userId = session.user.id;

  // Verify family access
  const membership = await prisma.familyMember.findFirst({
    where: { userId, deletedAt: null },
    select: { familyId: true },
  });
  if (!membership) {
    return { success: false, error: "You must belong to a family." };
  }

  const result = await prisma.parkrunResult.findUnique({
    where: { id: resultId },
    select: { userId: true },
  });
  if (!result) {
    return { success: false, error: "Result not found." };
  }

  const ownerMembership = await prisma.familyMember.findFirst({
    where: { userId: result.userId, familyId: membership.familyId, deletedAt: null },
  });
  if (!ownerMembership) {
    return { success: false, error: "Result not found." };
  }

  // Check existing (including soft-deleted)
  const existing = await prisma.cheer.findUnique({
    where: { resultId_userId: { resultId, userId } },
  });

  if (existing) {
    if (existing.deletedAt) {
      await prisma.cheer.update({
        where: { id: existing.id },
        data: { deletedAt: null },
      });
      return { success: true, added: true };
    } else {
      await prisma.cheer.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });
      return { success: true, added: false };
    }
  }

  await prisma.cheer.create({
    data: { resultId, userId },
  });
  return { success: true, added: true };
}

export async function getCheerCount(resultId: string): Promise<{ count: number; cheered: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { count: 0, cheered: false };

  const cheers = await prisma.cheer.findMany({
    where: { resultId, deletedAt: null },
    select: { userId: true },
  });

  return {
    count: cheers.length,
    cheered: cheers.some((c) => c.userId === session.user!.id),
  };
}

export type ActivityItem = {
  id: string;
  type: "result" | "comment" | "reaction" | "cheer" | "milestone";
  actorName: string;
  action: string;
  target: string;
  resultId?: string;
  createdAt: string;
};

export async function getActivityFeed(): Promise<ActivityItem[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  // Get user's family
  const membership = await prisma.familyMember.findFirst({
    where: { userId: session.user.id, deletedAt: null },
    select: { familyId: true },
  });
  if (!membership) return [];

  // Get all family member user IDs
  const familyMembers = await prisma.familyMember.findMany({
    where: { familyId: membership.familyId, deletedAt: null },
    select: { userId: true },
  });
  const familyUserIds = familyMembers.map((m) => m.userId);

  // Fetch recent activity in parallel
  const [results, comments, reactions, cheers, milestones] = await Promise.all([
    prisma.parkrunResult.findMany({
      where: { userId: { in: familyUserIds } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { name: true } },
        location: { select: { name: true } },
      },
    }),
    prisma.comment.findMany({
      where: { userId: { in: familyUserIds }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { name: true } },
        result: {
          select: { user: { select: { name: true } } },
        },
      },
    }),
    prisma.reaction.findMany({
      where: { userId: { in: familyUserIds }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { name: true } },
        result: {
          select: { user: { select: { name: true } } },
        },
      },
    }),
    prisma.cheer.findMany({
      where: { userId: { in: familyUserIds }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { name: true } },
        result: {
          select: { user: { select: { name: true } } },
        },
      },
    }),
    prisma.milestone.findMany({
      where: { userId: { in: familyUserIds } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { name: true } },
      },
    }),
  ]);

  const items: ActivityItem[] = [];

  for (const r of results) {
    items.push({
      id: `result-${r.id}`,
      type: "result",
      actorName: r.user.name ?? "Unknown",
      action: "posted a result",
      target: `${r.location.name} — ${Math.floor(r.finishTimeSecs / 60)}:${String(r.finishTimeSecs % 60).padStart(2, "0")}`,
      resultId: r.id,
      createdAt: r.createdAt.toISOString(),
    });
  }

  for (const c of comments) {
    items.push({
      id: `comment-${c.id}`,
      type: "comment",
      actorName: c.user.name ?? "Unknown",
      action: "commented on",
      target: `${c.result.user.name ?? "Unknown"}'s result`,
      resultId: c.resultId,
      createdAt: c.createdAt.toISOString(),
    });
  }

  for (const r of reactions) {
    items.push({
      id: `reaction-${r.id}`,
      type: "reaction",
      actorName: r.user.name ?? "Unknown",
      action: `reacted ${r.emoji} to`,
      target: `${r.result.user.name ?? "Unknown"}'s result`,
      resultId: r.resultId,
      createdAt: r.createdAt.toISOString(),
    });
  }

  for (const c of cheers) {
    items.push({
      id: `cheer-${c.id}`,
      type: "cheer",
      actorName: c.user.name ?? "Unknown",
      action: "cheered",
      target: `${c.result.user.name ?? "Unknown"}'s result`,
      resultId: c.resultId,
      createdAt: c.createdAt.toISOString(),
    });
  }

  for (const m of milestones) {
    items.push({
      id: `milestone-${m.id}`,
      type: "milestone",
      actorName: m.user.name ?? "Unknown",
      action: "earned a milestone",
      target: m.value,
      createdAt: m.createdAt.toISOString(),
    });
  }

  // Sort by createdAt descending, take top 50
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items.slice(0, 50);
}
