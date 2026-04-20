"use server";

import { prisma } from "../prisma";
import { auth } from "../auth/auth";
import { z } from "zod";

const addCommentSchema = z.object({
  resultId: z.string().min(1),
  text: z.string().min(1, "Comment cannot be empty").max(500, "Comment is too long"),
});

export type CommentItem = {
  id: string;
  text: string;
  authorName: string;
  authorId: string;
  createdAt: string;
};

export type AddCommentResult =
  | { success: true; comment: CommentItem }
  | { success: false; error: string };

export async function addComment(input: {
  resultId: string;
  text: string;
}): Promise<AddCommentResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated." };
  }
  const userId = session.user.id;

  const parsed = addCommentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Verify user belongs to a family
  const membership = await prisma.familyMember.findFirst({
    where: { userId, deletedAt: null },
    select: { familyId: true },
  });
  if (!membership) {
    return { success: false, error: "You must belong to a family." };
  }

  // Verify result exists and belongs to same family
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

  const comment = await prisma.comment.create({
    data: {
      resultId: parsed.data.resultId,
      userId,
      text: parsed.data.text.trim(),
    },
    include: {
      user: { select: { name: true } },
    },
  });

  return {
    success: true,
    comment: {
      id: comment.id,
      text: comment.text,
      authorName: comment.user.name ?? "Unknown",
      authorId: comment.userId,
      createdAt: comment.createdAt.toISOString(),
    },
  };
}

export async function deleteComment(
  commentId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated." };
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { userId: true, deletedAt: true },
  });
  if (!comment || comment.deletedAt) {
    return { success: false, error: "Comment not found." };
  }
  if (comment.userId !== session.user.id) {
    return { success: false, error: "You can only delete your own comments." };
  }

  await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });

  return { success: true };
}

export async function restoreComment(
  commentId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated." };
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { userId: true, deletedAt: true },
  });
  if (!comment) {
    return { success: false, error: "Comment not found." };
  }
  if (comment.userId !== session.user.id) {
    return { success: false, error: "You can only restore your own comments." };
  }

  await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: null },
  });

  return { success: true };
}

export async function getComments(resultId: string): Promise<CommentItem[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  // Verify family access
  const membership = await prisma.familyMember.findFirst({
    where: { userId: session.user.id, deletedAt: null },
    select: { familyId: true },
  });
  if (!membership) return [];

  const result = await prisma.parkrunResult.findUnique({
    where: { id: resultId },
    select: { userId: true },
  });
  if (!result) return [];

  const ownerMembership = await prisma.familyMember.findFirst({
    where: { userId: result.userId, familyId: membership.familyId, deletedAt: null },
  });
  if (!ownerMembership) return [];

  const comments = await prisma.comment.findMany({
    where: { resultId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { name: true } },
    },
  });

  return comments.map((c) => ({
    id: c.id,
    text: c.text,
    authorName: c.user.name ?? "Unknown",
    authorId: c.userId,
    createdAt: c.createdAt.toISOString(),
  }));
}
