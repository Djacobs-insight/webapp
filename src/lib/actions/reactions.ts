"use server";

import { prisma } from "../prisma";
import { auth } from "../auth/auth";
import { z } from "zod";
import { ALLOWED_EMOJIS } from "../reactions-constants";
import type { ReactionGroup, ToggleReactionResult } from "../reactions-constants";

const toggleReactionSchema = z.object({
  resultId: z.string().min(1),
  emoji: z.string().refine((e) => ALLOWED_EMOJIS.includes(e), "Invalid emoji"),
});

export async function toggleReaction(input: {
  resultId: string;
  emoji: string;
}): Promise<ToggleReactionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated." };
  }
  const userId = session.user.id;

  const parsed = toggleReactionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Verify family access
  const membership = await prisma.familyMember.findFirst({
    where: { userId, deletedAt: null },
    select: { familyId: true },
  });
  if (!membership) {
    return { success: false, error: "You must belong to a family." };
  }

  const result = await prisma.parkrunResult.findUnique({
    where: { id: parsed.data.resultId },
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

  // Check if reaction already exists (including soft-deleted)
  const existing = await prisma.reaction.findUnique({
    where: {
      resultId_userId_emoji: {
        resultId: parsed.data.resultId,
        userId,
        emoji: parsed.data.emoji,
      },
    },
  });

  if (existing) {
    if (existing.deletedAt) {
      // Restore soft-deleted reaction
      await prisma.reaction.update({
        where: { id: existing.id },
        data: { deletedAt: null },
      });
      return { success: true, added: true };
    } else {
      // Soft-delete to toggle off
      await prisma.reaction.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });
      return { success: true, added: false };
    }
  }

  // Create new reaction
  await prisma.reaction.create({
    data: {
      resultId: parsed.data.resultId,
      userId,
      emoji: parsed.data.emoji,
    },
  });
  return { success: true, added: true };
}

export async function getReactions(resultId: string): Promise<ReactionGroup[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const reactions = await prisma.reaction.findMany({
    where: { resultId, deletedAt: null },
    select: { emoji: true, userId: true },
  });

  // Group by emoji
  const groups = new Map<string, { count: number; reacted: boolean }>();
  for (const r of reactions) {
    const existing = groups.get(r.emoji) ?? { count: 0, reacted: false };
    existing.count++;
    if (r.userId === session.user.id) existing.reacted = true;
    groups.set(r.emoji, existing);
  }

  return Array.from(groups.entries()).map(([emoji, { count, reacted }]) => ({
    emoji,
    count,
    reacted,
  }));
}


