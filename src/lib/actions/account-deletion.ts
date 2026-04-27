"use server";

import { prisma } from "../prisma";
import { auth } from "../auth/auth";
import { randomUUID } from "crypto";

export type DeleteAccountResult =
  | { success: true; token: string }
  | { success: false; error: string };

/**
 * Soft-delete all user data. Returns a cancellation token.
 * The client has 5 seconds to call undoDeleteAccount(token) to reverse.
 */
export async function requestAccountDeletion(): Promise<DeleteAccountResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  const userId = session.user.id;
  const now = new Date();

  // Soft-delete all user data in a transaction
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { deletedAt: now },
    }),
    prisma.parkrunResult.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.photo.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.comment.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.reaction.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.cheer.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.userBadge.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.milestone.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.familyMember.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.challengeParticipant.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.challenge.updateMany({
      where: { createdById: userId, deletedAt: null },
      data: { deletedAt: now },
    }),
  ]);

  // SECURITY: Use a random token instead of predictable timestamp
  const token = randomUUID();

  // Create a deletion record to track undo tokens
  await prisma.accountDeletion.create({
    data: {
      userId,
      undoToken: token,
      deletedAt: now,
    },
  });

  return { success: true, token };
}

/**
 * Reverse a pending account deletion by clearing deletedAt matching the undo token.
 * SECURITY: Token is now a random UUID instead of predictable timestamp.
 */
export async function undoDeleteAccount(
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  const userId = session.user.id;

  // SECURITY: Validate token exists and belongs to this user
  const deletion = await prisma.accountDeletion.findUnique({
    where: { undoToken: token },
    select: { userId: true, deletedAt: true },
  });

  if (!deletion || deletion.userId !== userId) {
    return { success: false, error: "Invalid or expired token" };
  }

  const deletedAt = deletion.deletedAt;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null },
    }),
    prisma.parkrunResult.updateMany({
      where: { userId, deletedAt },
      data: { deletedAt: null },
    }),
    prisma.photo.updateMany({
      where: { userId, deletedAt },
      data: { deletedAt: null },
    }),
    prisma.comment.updateMany({
      where: { userId, deletedAt },
      data: { deletedAt: null },
    }),
    prisma.reaction.updateMany({
      where: { userId, deletedAt },
      data: { deletedAt: null },
    }),
    prisma.cheer.updateMany({
      where: { userId, deletedAt },
      data: { deletedAt: null },
    }),
    prisma.userBadge.updateMany({
      where: { userId, deletedAt },
      data: { deletedAt: null },
    }),
    prisma.milestone.updateMany({
      where: { userId, deletedAt },
      data: { deletedAt: null },
    }),
    prisma.familyMember.updateMany({
      where: { userId, deletedAt },
      data: { deletedAt: null },
    }),
    prisma.challengeParticipant.updateMany({
      where: { userId, deletedAt },
      data: { deletedAt: null },
    }),
    prisma.challenge.updateMany({
      where: { createdById: userId, deletedAt },
      data: { deletedAt: null },
    }),
  ]);

  return { success: true };
}
